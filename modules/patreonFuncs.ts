import type { ChatInputCommandInteraction, Client, Embed, Message } from "discord.js";
import Language from "../base/Language.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import patreonModule from "../data/patreon.ts";
import type { RawGuild, SWAPIGuild, SWAPIPlayer } from "../types/swapi_types.ts";
import type {
    ActivePatron,
    ArenaHistChartPayload,
    ArenaHistEntry,
    ArenaPlayer,
    ArenaWatchAcct,
    ArenaWatchConfig,
    PatronUser,
    PlayerArenaRes,
    PlayerUpdates,
    UserConfig,
} from "../types/types.ts";
import arenaPlayerRegistry from "./arenaPlayerRegistry.ts";
import cache from "./cache.ts";
import { chunkArray, expandSpaces, formatDuration, getPayoutTimeLeft, msgArray, toProperCase, wait } from "./functions.ts";
import { getGuildSupporterTier } from "./guildConfig/patreonSettings.ts";
import logger from "./Logger.ts";
import swgohAPI from "./swapi.ts";
import userReg from "./users.ts";

export function updateArenaHistory(hist: ArenaHistEntry[] | undefined, rank: number): ArenaHistEntry[] {
    const entries = hist ? [...hist] : [];
    entries.push({ rank, ts: Date.now() });
    entries.sort((a, b) => a.ts - b.ts);
    while (entries.length > 90) entries.shift(); // oldest entries are always at index 0 after sort
    return entries;
}

// Returns true when a new payout entry should be written. Prevents duplicate entries when
// the poll cycle fires multiple times within the same payout minute.
export function shouldWriteHistory(hist: ArenaHistEntry[] | undefined): boolean {
    if (!hist?.length) return true;
    // updateArenaHistory always persists a sorted array, so at(-1) is the newest entry.
    const lastTs = hist.at(-1)?.ts ?? 0;
    return Date.now() - lastTs > 5 * constants.minMS;
}

export function buildArenaHistChart(
    charHist: ArenaHistEntry[] | undefined,
    shipHist: ArenaHistEntry[] | undefined,
    windowDays: number,
    now: number,
    label: string,
): ArenaHistChartPayload | null {
    const { dayMS } = constants;
    const tickInterval = windowDays === 90 ? 7 : 1;

    // dates[0] = (windowDays-1) days ago … dates[last] = today
    const dates: Date[] = [];
    for (let d = 0; d < windowDays; d++) {
        dates.push(new Date(now - (windowDays - 1 - d) * dayMS));
    }

    // Pre-compute UTC midnight for each day once; reused by windowStart, toDataArray (both datasets)
    const dayBoundaries = dates.map((date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const windowStart = dayBoundaries[0];

    const filteredChar = (charHist ?? []).filter((e) => e.ts >= windowStart && e.ts <= now);
    const filteredFleet = (shipHist ?? []).filter((e) => e.ts >= windowStart && e.ts <= now);

    if (!filteredChar.length && !filteredFleet.length) return null;

    // Map entries onto calendar-day positions; days with no entry become null
    function toDataArray(entries: ArenaHistEntry[]): (number | null)[] {
        // shouldWriteHistory enforces a 5-minute dedup guard, so at most one entry
        // per calendar day is stored in practice; find() returning the first match is correct.
        return dayBoundaries.map((dayStart) => {
            const dayEnd = dayStart + dayMS;
            return entries.find((e) => e.ts >= dayStart && e.ts < dayEnd)?.rank ?? null;
        });
    }

    // X-axis: weekly ticks for 90d (intermediate labels = ""), daily for 7d/30d
    const labels = dates.map((date, i) => {
        if (i % tickInterval !== 0) return "";
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    });

    const datasets: ArenaHistChartPayload["datasets"] = [];

    if (filteredChar.length) {
        datasets.push({
            label: "Char Arena",
            data: toDataArray(filteredChar),
            borderColor: "#4a90d9",
            backgroundColor: "rgba(74,144,217,0.1)",
            tension: 0.3,
            fill: false,
        });
    }

    if (filteredFleet.length) {
        datasets.push({
            label: "Fleet Arena",
            data: toDataArray(filteredFleet),
            borderColor: "#e8874a",
            borderDash: [6, 4],
            tension: 0.3,
            fill: false,
        });
    }

    return {
        labels,
        datasets,
        title: `Arena Rank — Last ${windowDays} Days — ${label}`,
        width: 800,
        height: 400,
        pointLabels: true,
    };
}

// The rank/climb fields handleArenaAlerts updates on the arenaPlayers doc
type ArenaRankTracking = Pick<ArenaPlayer, "lastCharRank" | "lastCharClimb" | "lastShipRank" | "lastShipClimb">;

// Ranks as they stood at the start of an arenaTick. Multiple patrons can track the same
// ally code (and one patron can both register and watch it), so change detection must
// compare against this snapshot rather than the live docs — otherwise the first consumer
// to update a doc suppresses the same rank change for everyone after it.
export type RankSnapshot = Map<number, ArenaRankTracking>;

export function buildRankSnapshot(arenaPlayerMap: Map<number, ArenaPlayer>): RankSnapshot {
    const snapshot: RankSnapshot = new Map();
    for (const [allyCode, doc] of arenaPlayerMap) {
        snapshot.set(allyCode, {
            lastCharRank: doc.lastCharRank,
            lastCharClimb: doc.lastCharClimb,
            lastShipRank: doc.lastShipRank,
            lastShipClimb: doc.lastShipClimb,
        });
    }
    return snapshot;
}

// Merge persisted arenaPlayers data (name/ranks) onto watch-list entries, which only
// store per-watch settings (mention, poOffset, marks). Returns fresh objects so callers
// can attach ephemeral fields (duration, timeTil, outString) without mutating the user doc.
export function hydrateWatchAccounts(entries: ArenaWatchConfig[], playerMap: Map<number, ArenaPlayer>): ArenaWatchAcct[] {
    return entries.map((entry) => {
        const doc = playerMap.get(entry.allyCode);
        return {
            ...structuredClone(entry),
            // mention/poOffset can be absent on migrated entries — normalize them here so the
            // hydrated account always satisfies ArenaWatchAcct
            mention: entry.mention ?? null,
            poOffset: entry.poOffset ?? 0,
            name: doc?.name || String(entry.allyCode),
            lastChar: doc?.lastCharRank ?? null,
            lastShip: doc?.lastShipRank ?? null,
        };
    });
}

const tiers = patreonModule.tiers;

// Patron tier thresholds (in cents)
const TIER_1_CENTS = 100; // $1
const TIER_5_CENTS = 500; // $5
const TIER_10_CENTS = 1000; // $10

// How many arenaWatch accounts a patron's tier allows
function getAwAcctCount(amountCents: number): number {
    if (amountCents < TIER_5_CENTS) return constants.arenaWatchConfig.tier1;
    if (amountCents < TIER_10_CENTS) return constants.arenaWatchConfig.tier2;
    return constants.arenaWatchConfig.tier3;
}

export function collectAllyCodes(patrons: ActivePatron[], userMap: Map<string, UserConfig>): number[] {
    const codes = new Set<number>();
    for (const patron of patrons) {
        if (patron.amount_cents < TIER_1_CENTS) continue;
        const user = userMap.get(patron.discordID);
        if (!user) continue;
        for (const allyCode of user.accounts ?? []) {
            codes.add(allyCode);
        }
        // Watch entries past the tier limit are never processed, so don't fetch them
        const acctCount = getAwAcctCount(patron.amount_cents);
        for (const awAcct of user.arenaWatch?.allyCodes?.slice(0, acctCount) ?? []) {
            codes.add(awAcct.allyCode);
        }
    }
    return [...codes];
}

class PatreonFuncs {
    private client!: Client<true>;

    /**
     * Initialize the PatreonFuncs module with Discord client dependency
     */
    init(client: Client<true>): void {
        this.client = client;
    }

    private async buildPlayerMap(allyCodes: number[]): Promise<Map<number, PlayerArenaRes>> {
        const map = new Map<number, PlayerArenaRes>();
        if (!allyCodes.length) return map;
        const chunks = chunkArray(allyCodes, 50);
        for (const chunk of chunks) {
            let attempts = 0;
            while (attempts < 3) {
                try {
                    const results = await swgohAPI.getPlayersArena(chunk);
                    for (const player of results ?? []) {
                        map.set(player.allyCode, player);
                    }
                    break;
                } catch (e) {
                    const code = e instanceof Error && "code" in e ? (e as Error & { code: unknown }).code : null;
                    if (code === 6 && attempts < 2) {
                        await wait(1000 * (attempts + 1));
                        attempts++;
                    } else {
                        logger.error(
                            `[buildPlayerMap] Failed to fetch chunk of ${chunk.length} codes: ${e instanceof Error ? e.message : String(e)}`,
                        );
                        break;
                    }
                }
            }
        }
        return map;
    }

    // Check if a given user is a patron, and if so, return their info
    async getPatronUser(userId: string): Promise<PatronUser | null> {
        if (!userId) throw new Error("Missing user ID");

        // Try and get em from the db
        const patron = (await cache.getOne("swgohbot", "patrons", { discordID: userId })) as PatronUser;

        // If they aren't in the db, see if we have em in there manually
        if (!patron && env.PATRONS?.[userId]) {
            const currentAmountCents = env.PATRONS[userId];
            const currentTierNum = this.getPatreonTier({ amount_cents: currentAmountCents });
            const currentTier = tiers[currentTierNum];
            return {
                userId: userId,
                playerTime: currentTier.playerTime,
                guildTime: currentTier.guildTime,
                awAccounts: currentTier.awAccounts,
                discordID: userId,
                amount_cents: currentAmountCents,
            };
        }

        // If they're not in either spot, return null
        if (!patron) return null;

        const currentTierNum = this.getPatreonTier(patron);
        if (!currentTierNum) return null;
        const currentTier = tiers[currentTierNum];

        return {
            ...patron,
            playerTime: currentTier.playerTime,
            guildTime: currentTier.guildTime,
            awAccounts: currentTier.awAccounts,
        };
    }

    // Get the cooldown for the given player
    //  - If the user is a Patreon subscriber or someone in their server selected it as their bonus
    //      * Give them the best lowered times available to them
    //  - If the user isn't a subscriber, and no one in their server selected it
    //      * Give them the defaults set in the data/patreon.js file
    async getPlayerCooldown(userId: string, guildId?: string): Promise<{ player: number; guild: number }> {
        const patron = await this.getPatronUser(userId);

        // This will give the highest/ combined tier that anyone has set for the server, or 0 if none
        const supporterTier = await getGuildSupporterTier({ guildId });

        // Grab the best times available based on the supporterTier
        const supporterTimes: { playerTime: number; guildTime: number } = !tiers?.[supporterTier]?.sharePlayer
            ? tiers[0]
            : {
                  playerTime: tiers[supporterTier].sharePlayer,
                  guildTime: tiers[supporterTier].shareGuild,
              };

        // Grab the best times for the user themselves, patreon sub or not
        const playerTier = this.getPatreonTier(patron);
        const playerTimes: { playerTime: number; guildTime: number } = tiers?.[playerTier] || tiers[0];

        // Return the best times available between the supporter and the user
        return {
            player: playerTimes?.playerTime < supporterTimes?.playerTime ? playerTimes.playerTime : supporterTimes.playerTime,
            guild: playerTimes?.guildTime < supporterTimes?.guildTime ? playerTimes.guildTime : supporterTimes.guildTime,
        };
    }

    private async processArenaAlerts(
        patron: ActivePatron,
        user: UserConfig,
        playerMap: Map<number, PlayerArenaRes>,
        arenaPlayerMap: Map<number, ArenaPlayer>,
        changedCodes: Set<number>,
        rankSnapshot: RankSnapshot,
    ): Promise<void> {
        if (user.arenaAlert) {
            if (!user.arenaAlert.payoutWarning) user.arenaAlert.payoutWarning = 0;
            if (!user.arenaAlert.arena) user.arenaAlert.arena = "none";
        }

        for (const allyCode of user.accounts ?? []) {
            if (
                ((user.accounts.length > 1 && patron.amount_cents < TIER_5_CENTS) || user.arenaAlert?.enableRankDMs === "primary") &&
                allyCode !== user.primaryAllyCode
            ) {
                continue;
            }

            const playerDoc = arenaPlayerMap.get(allyCode) ?? { allyCode, name: "" };

            // In-memory defaults only — not marked changed; they persist alongside the next real change
            playerDoc.lastCharRank ??= 0;
            playerDoc.lastCharClimb ??= 0;
            playerDoc.lastShipRank ??= 0;
            playerDoc.lastShipClimb ??= 0;

            const player = playerMap.get(allyCode) ?? null;

            if (!player) {
                logger.log(`[processArenaAlerts] Missing player data for ${allyCode}`);
                continue;
            }
            if (!player.arena) {
                logger.log(`[processArenaAlerts] No arena data for ${allyCode}: ${JSON.stringify(player)}`);
                continue;
            }

            const pCharRank = player.arena.char?.rank;
            const pShipRank = player.arena.ship?.rank;
            if (!pCharRank && pCharRank !== 0 && !pShipRank && pShipRank !== 0) {
                logger.error(`[processArenaAlerts] No arena ranks for ${allyCode}: ${JSON.stringify(player)}`);
                continue;
            }

            // Refresh the stored name whenever the API provides a non-empty one (renames propagate)
            if (player.name && player.name !== playerDoc.name) {
                playerDoc.name = player.name;
                changedCodes.add(allyCode);
            }

            // Record payout history (runs for all patrons regardless of arenaAlert config) and
            // run DM alerts in a single pass per arena type — both need timeLeft/minTil, and
            // getPayoutTimeLeft() involves a Temporal lookup, so compute it once and share it.
            for (const arenaType of ["char", "ship"] as const) {
                const arenaData = arenaType === "char" ? player.arena.char : player.arena.ship;
                if (arenaData?.rank == null) continue;
                const timeLeft = getPayoutTimeLeft(player.poUTCOffsetMinutes, arenaType === "char" ? "char" : "fleet");
                const minTil = Math.floor(timeLeft / constants.minMS);

                const histKey = arenaType === "char" ? "charHist" : "shipHist";
                const newHist = this.recordHistoryAtPayout(playerDoc[histKey], arenaData.rank, minTil);
                if (newHist !== playerDoc[histKey]) {
                    playerDoc[histKey] = newHist;
                    changedCodes.add(allyCode);
                }

                const rankKey = arenaType === "char" ? "lastCharRank" : "lastShipRank";
                const climbKey = arenaType === "char" ? "lastCharClimb" : "lastShipClimb";
                const prevRank = playerDoc[rankKey];
                const prevClimb = playerDoc[climbKey];

                // DM alerts compare against the tick-start snapshot, not the live doc — another
                // patron tracking the same account may have already updated the doc this tick
                const snap = rankSnapshot.get(allyCode);
                await this.handleArenaAlerts(arenaType, player, playerDoc, user, patron, timeLeft, minTil, {
                    rank: snap?.[rankKey] ?? 0,
                    climb: snap?.[climbKey] ?? 0,
                });

                if (playerDoc[rankKey] !== prevRank || playerDoc[climbKey] !== prevClimb) {
                    changedCodes.add(allyCode);
                }
            }

            arenaPlayerMap.set(allyCode, playerDoc);
        }
        // No longer writes user doc — arenaTick flushes arenaPlayerMap after all patrons
    }

    // Single per-minute arena cycle: batch-fetch all ally codes, then run alerts and shard processing
    async arenaTick(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const eligibleIds = patrons.filter((p) => p.amount_cents >= TIER_1_CENTS).map((p) => p.discordID);
        const userMap = await userReg.getUsersByIds(eligibleIds);
        const allyCodes = collectAllyCodes(patrons, userMap);
        const playerMap = await this.buildPlayerMap(allyCodes);
        const arenaPlayerMap = await arenaPlayerRegistry.batchGet(allyCodes);
        // Freeze the tick-start ranks before any consumer mutates the shared docs, so every
        // patron tracking an account sees the same rank change
        const rankSnapshot = buildRankSnapshot(arenaPlayerMap);
        const changedCodes = new Set<number>();

        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user = userMap.get(patron.discordID);
            if (!user) continue;
            if (user.accounts?.length) {
                await this.processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot).catch((err) => {
                    logger.error(
                        `[arenaTick] processArenaAlerts error for ${patron.discordID}: ${err instanceof Error ? err.message : String(err)}`,
                    );
                });
            }
            await this.processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot).catch((err) => {
                logger.error(
                    `[arenaTick] processShardPatron error for ${patron.discordID}: ${err instanceof Error ? err.message : String(err)}`,
                );
            });
        }

        // Only write docs that actually changed this tick — the map holds every loaded doc
        if (changedCodes.size) {
            const changedDocs = [...changedCodes]
                .map((code) => arenaPlayerMap.get(code))
                .filter((doc): doc is ArenaPlayer => doc !== undefined);
            await arenaPlayerRegistry.batchUpsert(changedDocs).catch((err) => {
                logger.error(`[arenaTick] batchUpsert error: ${err instanceof Error ? err.message : String(err)}`);
            });
        }
    }

    // Send/ update a shard payout times message (Automated shardtimes)
    async shardTimes(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const eligibleIds = patrons.filter((p) => p.amount_cents >= TIER_1_CENTS).map((p) => p.discordID);
        const userMap = await userReg.getUsersByIds(eligibleIds);

        // Gather every watch code up front so the registry is hit once, not once per patron.
        // Slightly over-fetches for patrons whose payout channels turn out to be disabled.
        const codesToFetch = new Set<number>();
        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const aw = userMap.get(patron.discordID)?.arenaWatch;
            if (!aw?.payout) continue;
            for (const entry of aw.allyCodes.slice(0, getAwAcctCount(patron.amount_cents))) {
                codesToFetch.add(entry.allyCode);
            }
        }
        const playerDocMap = await arenaPlayerRegistry.batchGet([...codesToFetch]);

        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user = userMap.get(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user?.arenaWatch?.payout) continue;
            const aw = user.arenaWatch;

            // Make sure at least one of the alerts is enabled, no point otherwise
            if (!aw?.payout) continue;
            if ((!aw.payout?.char?.enabled || !aw.payout?.char?.channel) && (!aw.payout?.fleet?.enabled || !aw.payout?.fleet?.channel))
                continue;

            // Names and ranks live in the arenaPlayers collection now, so hydrate the watch
            // entries before formatting the payout schedule
            const watchEntries = aw.allyCodes.slice(0, getAwAcctCount(patron.amount_cents));
            if (!watchEntries.length) continue;
            const players = hydrateWatchAccounts(watchEntries, playerDocMap);

            const [charMsg, fleetMsg] = await Promise.all([
                aw?.payout?.char?.enabled && aw.payout.char.channel
                    ? (this.sendBroadcastMsg(
                          aw.payout.char.msgID,
                          aw.payout.char.channel,
                          this.formatPayouts(this.getPayoutTimes(players, "char"), "char"),
                      ) as Promise<Message>)
                    : Promise.resolve(null),
                aw?.payout?.fleet?.enabled && aw.payout.fleet.channel
                    ? (this.sendBroadcastMsg(
                          aw.payout.fleet.msgID,
                          aw.payout.fleet.channel,
                          this.formatPayouts(this.getPayoutTimes(players, "fleet"), "fleet"),
                      ) as Promise<Message>)
                    : Promise.resolve(null),
            ]);
            if (charMsg) user.arenaWatch.payout.char.msgID = charMsg.id;
            if (fleetMsg) user.arenaWatch.payout.fleet.msgID = fleetMsg.id;
            // Update the user in case something changed (Likely message ID)
            await userReg.updateUser(patron.discordID, user);
        }
    }

    // Process a single patron's arena rank notifications. Extracted so errors in one patron
    // don't abort the entire arenaTick loop and cause everyone after them to be skipped.
    private async processShardPatron(
        patron: ActivePatron,
        user: UserConfig | null,
        playerMap: Map<number, PlayerArenaRes>,
        arenaPlayerMap: Map<number, ArenaPlayer>,
        changedCodes: Set<number>,
        rankSnapshot: RankSnapshot,
    ): Promise<void> {
        if (!user?.arenaWatch) return;
        const aw = user.arenaWatch;

        // Fill in missing arena sub-configs with disabled defaults so the rest of the function
        // can safely access their properties without crashing on old/partial DB records.
        aw.arena ??= { char: { channel: null, enabled: false }, fleet: { channel: null, enabled: false } };
        aw.arena.char ??= { channel: null, enabled: false };
        aw.arena.fleet ??= { channel: null, enabled: false };

        // Check if they have either alerts or payouts enabled
        const hasAlerts = (aw.arena.fleet.channel || aw.arena.char.channel) && (aw.arena.fleet.enabled || aw.arena.char.enabled);
        const hasPayouts =
            aw?.payout &&
            ((aw.payout?.char?.enabled && aw.payout?.char?.channel) || (aw.payout?.fleet?.enabled && aw.payout?.fleet?.channel));

        // If they don't want any alerts or payouts, skip
        if (!hasAlerts && !hasPayouts) return;

        const acctCount = getAwAcctCount(patron.amount_cents);
        // Hydrate names/ranks from the arenaPlayers docs so every account has a usable name
        // and the persisted rank seeded before the payout/warn logic below runs
        const accountsToCheck = hydrateWatchAccounts(aw.allyCodes.slice(0, acctCount), arenaPlayerMap);
        if (!accountsToCheck.length) return;

        // Go through all the listed players, and see if any of them have shifted arena rank or payouts incoming
        const compChar = [];
        const compShip = [];
        let charOut = [];
        let shipOut = [];
        for (const [ix, player] of accountsToCheck.entries()) {
            const newPlayer = playerMap.get(player.allyCode) ?? null;
            if (!newPlayer?.arena?.char?.rank && !newPlayer?.arena?.ship?.rank) {
                // Both, since low level players can have just char arena I believe
                continue;
            }
            // Refresh the name only when the API provides a non-empty one
            if (newPlayer.name) {
                player.name = newPlayer.name;
            }
            if (player.poOffset !== newPlayer.poUTCOffsetMinutes) {
                player.poOffset = newPlayer.poUTCOffsetMinutes;
            }

            // Load persisted rank/history from arenaPlayerMap; create a stub if not found.
            // player.name was hydrated from the doc, falling back to the ally code string.
            const playerDoc = arenaPlayerMap.get(player.allyCode) ?? {
                allyCode: player.allyCode,
                name: newPlayer.name || player.name,
            };

            // For a freshly-created stub this is always false (name already matches); this only
            // refreshes an existing doc's stale name.
            if (newPlayer.name && newPlayer.name !== playerDoc.name) {
                playerDoc.name = newPlayer.name;
                changedCodes.add(player.allyCode);
            }

            // Compare against the tick-start snapshot, not the live doc — processArenaAlerts
            // (or another patron watching the same account) may have already updated the doc
            const snap = rankSnapshot.get(player.allyCode);
            const prevLastChar = snap?.lastCharRank ?? 0;
            const prevLastShip = snap?.lastShipRank ?? 0;

            if (newPlayer.arena?.char?.rank != null && newPlayer.arena.char.rank !== prevLastChar) {
                const charOverview = {
                    name: player.mention ? `<@${player.mention}>` : player.name,
                    allyCode: player.allyCode,
                    oldRank: prevLastChar,
                    newRank: newPlayer.arena.char.rank,
                    mark: player.mark,
                };
                compChar.push(charOverview);
                player.lastChar = newPlayer.arena.char.rank;
                player.lastCharChange = prevLastChar - newPlayer.arena.char.rank;
                playerDoc.lastCharRank = player.lastChar;
                playerDoc.lastCharChange = player.lastCharChange;
                changedCodes.add(player.allyCode);
            }
            if (newPlayer.arena?.ship?.rank != null && newPlayer.arena.ship.rank !== prevLastShip) {
                const shipOverview = {
                    name: player.mention ? `<@${player.mention}>` : player.name,
                    allyCode: player.allyCode,
                    oldRank: prevLastShip,
                    newRank: newPlayer.arena.ship.rank,
                    mark: player.mark,
                };
                compShip.push(shipOverview);
                player.lastShip = newPlayer.arena.ship.rank;
                player.lastShipChange = prevLastShip - newPlayer.arena.ship.rank;
                playerDoc.lastShipRank = player.lastShip;
                playerDoc.lastShipChange = player.lastShipChange;
                changedCodes.add(player.allyCode);
            }

            const payouts = this.getAllPayoutTimes(player);
            const charMinLeft = payouts.charDuration;
            const fleetMinLeft = payouts.fleetDuration;

            // Record payout history for all arenaWatch accounts, regardless of notification settings
            const newCharHist = this.recordHistoryAtPayout(playerDoc.charHist, player.lastChar, charMinLeft);
            if (newCharHist !== playerDoc.charHist) {
                playerDoc.charHist = newCharHist;
                changedCodes.add(player.allyCode);
            }
            const newShipHist = this.recordHistoryAtPayout(playerDoc.shipHist, player.lastShip, fleetMinLeft);
            if (newShipHist !== playerDoc.shipHist) {
                playerDoc.shipHist = newShipHist;
                changedCodes.add(player.allyCode);
            }

            arenaPlayerMap.set(player.allyCode, playerDoc);

            if (player.result || (player.warn && player.warn.min > 0 && player.warn.arena)) {
                let pName = player.mention ? `<@${player.mention}>` : player.name;
                if (aw.useMarksInLog && player.mark) {
                    pName = `${player.mark} ${pName}`;
                }
                if (player.lastChar != null && charMinLeft === 0 && ["char", "both"].includes(player.result)) {
                    // If they have char payouts turned on, do that here
                    charOut.push(`${pName} finished at ${player.lastChar} in character arena`);
                }
                if (
                    player.lastChar != null &&
                    player.warn?.min &&
                    ["char", "both"].includes(player.warn.arena) &&
                    charMinLeft === player.warn.min
                ) {
                    // Warn them of their upcoming payout if this is enabled
                    charOut.push(`${pName}'s **character** arena payout is in ${`${player.warn.min} minutes`}`);
                }
                if (player.lastShip != null && fleetMinLeft === 0 && ["fleet", "both"].includes(player.result)) {
                    // If they have fleet payouts turned on, do that here
                    shipOut.push(`${pName} finished at ${player.lastShip} in fleet arena`);
                }
                if (
                    player.lastShip != null &&
                    player.warn?.min &&
                    ["fleet", "both"].includes(player.warn.arena) &&
                    fleetMinLeft === player.warn.min
                ) {
                    // Warn them of their upcoming payout if this is enabled
                    shipOut.push(`${pName}'s **fleet** arena payout is in ${`${player.warn.min} minutes`}`);
                }
            }
            accountsToCheck[ix] = player;
        }

        if (compChar.length && aw.arena.char.enabled) {
            charOut = charOut.concat(this.checkRanks(compChar, aw));
        }
        if (compShip.length && aw.arena.fleet.enabled) {
            shipOut = shipOut.concat(this.checkRanks(compShip, aw));
        }

        const charFields = [];
        const shipFields = [];
        if (charOut.length) {
            charFields.push("**Character Arena:**");
            charFields.push(charOut.map((c) => `- ${c}`).join("\n"));
        }
        if (shipOut.length) {
            shipFields.push("**Fleet Arena:**");
            shipFields.push(shipOut.map((c) => `- ${c}`).join("\n"));
        }

        // Only send the alerts if there have been rank changes, and the user has alerts enabled
        if ((charFields.length || shipFields.length) && hasAlerts) {
            if (aw.arena.char.channel && aw.arena.char.channel === aw.arena.fleet.channel) {
                // If they're both set to the same channel, send it all
                const fields = charFields.concat(shipFields);
                await this.client.shard.broadcastEval(
                    async (client, { aw, fields }) => {
                        const chan = client.channels.cache.get(aw.arena.char.channel);
                        if (
                            chan?.type === 0 && // 0 = GUILD_TEXT
                            // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                            chan?.permissionsFor(client.user).has(3072n)
                        ) {
                            await chan.send(`>>> ${fields.join("\n")}`);
                        }
                    },
                    { context: { aw: aw, fields: fields } },
                );
            } else {
                // Else they each have their own channels, so send em there
                await Promise.allSettled([
                    aw.arena.char.channel && aw.arena.char.enabled && charFields.length
                        ? this.client.shard.broadcastEval(
                              async (client, { aw, charFields }) => {
                                  const chan = client.channels.cache.get(aw.arena.char.channel);
                                  if (
                                      chan?.type === 0 && // 0 = GUILD_TEXT
                                      // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                                      chan?.permissionsFor(client.user).has(3072n)
                                  ) {
                                      await chan.send(`>>> ${charFields.join("\n")}`);
                                  }
                              },
                              { context: { aw: aw, charFields: charFields } },
                          )
                        : Promise.resolve(),
                    aw.arena.fleet.channel && aw.arena.fleet.enabled && shipFields.length
                        ? this.client.shard.broadcastEval(
                              async (client, { aw, shipFields }) => {
                                  const chan = client.channels.cache.get(aw.arena.fleet.channel);
                                  if (
                                      chan?.type === 0 && // 0 = GUILD_TEXT
                                      // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                                      chan?.permissionsFor(client.user).has(3072n)
                                  ) {
                                      await chan.send(`>>> ${shipFields.join("\n")}`);
                                  }
                              },
                              { context: { aw: aw, shipFields: shipFields } },
                          )
                        : Promise.resolve(),
                ]);
            }
        }

        // Update poOffset in user.arenaWatch.allyCodes after processing — rank/history now live
        // in the arenaPlayers collection, so poOffset is the only user-doc field this loop can
        // touch. Only write the doc back when one actually changed.
        const storedByCode = new Map(user.arenaWatch.allyCodes.map((a) => [a.allyCode, a]));
        let userChanged = false;
        for (const acct of accountsToCheck) {
            const stored = storedByCode.get(acct.allyCode);
            if (stored && stored.poOffset !== acct.poOffset) {
                stored.poOffset = acct.poOffset;
                userChanged = true;
            }
        }
        if (userChanged) {
            await userReg.updateUser(patron.discordID, user);
        }
    }

    async guildsUpdate(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const eligibleIds = patrons.filter((p) => p.discordID && p.amount_cents >= TIER_1_CENTS).map((p) => p.discordID);
        const userMap = await userReg.getUsersByIds(eligibleIds);
        for (const patron of patrons) {
            // Make sure to pass if there's no DiscordId or not at least in the $1 tier
            if (!patron.discordID || patron.amount_cents < TIER_1_CENTS) continue;
            const user = userMap.get(patron.discordID);

            // If the guild update isn't enabled, then move along
            if (!user?.guildUpdate?.enabled) continue;
            const gu = user.guildUpdate;
            if (!gu?.allyCode) continue;
            if (!gu?.channel) continue;

            // This is what will be in the user.guildUpdate, possibly add something
            // in to make it so it only shows above x gear lvl and such later?

            // gu = {
            //     enabled: false,          // If it's enabled or not
            //     allyCode: 123123123,     // Ally code to watch the guild of
            //     channel: channelID,      // The channel to log all this into
            // }

            // Check if the bot is able to send messages into the set channel
            const chanAvail = await this.isChannelAvailable(gu.channel);

            // If the channel is not available, move on
            if (!chanAvail) continue;

            // Get any updates for the guild
            let guild: SWAPIGuild = null;
            try {
                guild = await swgohAPI.guild(gu.allyCode);
            } catch (err) {
                const errStr = err instanceof Error ? err.message : String(err);
                if (errStr.includes("not in a guild")) continue;
                logger.error(`[patreonFuncs/guildsUpdate] Issue getting the guild from ${gu.allyCode}: ${errStr}`);
                continue;
            }
            if (!guild?.roster) {
                logger.error(
                    `[patreonFuncs/guildsUpdate] Could not get the guild/ roster for ${gu.allyCode}, guild output: ${JSON.stringify(guild)}`,
                );
                continue;
            }

            let guildLog: PlayerUpdates;
            try {
                if (!guild?.roster?.length) {
                    logger.error(`[patreonFuncs/guildsUpdate] Cannot get the roster for ${gu.allyCode}`);
                    continue;
                }
                guildLog = await swgohAPI.getPlayerUpdates(guild.roster.map((m) => m.allyCode));
            } catch (err) {
                logger.error(`[patreonFuncs/guildsUpdate] rosterLen: ${guild?.roster?.length}\n${err}`);
                continue;
            }

            // If there were not changes found, move along, not the changes we were looking for
            if (!Object.keys(guildLog).length) continue;

            // Processs the guild changes
            const fields = [];
            for (const memberName of Object.keys(guildLog).sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))) {
                const member = guildLog[memberName];
                const fieldVal = [];
                for (const cat of Object.keys(member)) {
                    if (!member[cat].length) continue;
                    fieldVal.push(...member[cat]);
                }

                // Run it through the splitter in case it needs it
                const outVals = msgArray(fieldVal, "\n", 900);
                for (const [ix, val] of outVals.entries()) {
                    fields.push({
                        name: ix === 0 ? memberName : `${memberName} (cont)`,
                        value: val,
                    });
                }
            }

            // If something went wonky and there were no fields put in, move along
            if (!fields.length) continue;

            const MAX_FIELDS = 6;
            const fieldsOut = chunkArray(fields, MAX_FIELDS);

            for (const fieldChunk of fieldsOut) {
                await this.client.shard.broadcastEval(
                    async (client, { guChan, fieldChunk }) => {
                        const channel = client.channels.cache.get(guChan);
                        if (
                            channel?.type === 0 && // 0 = GUILD_TEXT
                            channel?.guild &&
                            // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                            channel.permissionsFor(client.user).has(3072n)
                        ) {
                            return channel.send({
                                embeds: [
                                    {
                                        fields: fieldChunk,
                                    },
                                ],
                            });
                        }
                        return false;
                    },
                    {
                        context: {
                            guChan: gu.channel,
                            fieldChunk: fieldChunk,
                        },
                    },
                );
            }
        }
    }

    // Check guild tickets for each applicable member, and send the list of anyone who has not gotten 600 (Or their set value) yet
    async guildTickets(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const eligibleIds = patrons.filter((p) => p.discordID && p.amount_cents >= TIER_1_CENTS).map((p) => p.discordID);
        const userMap = await userReg.getUsersByIds(eligibleIds);
        const nowTime = Date.now();
        for (const patron of patrons) {
            // Make sure to pass if there's no DiscordId or not at least in the $1 tier
            if (!patron.discordID || patron.amount_cents < TIER_1_CENTS) continue;

            // This is what will be in the user.guildTickets
            // gt = {
            //     enabled:  false,                 // If it's enabled or not
            //     allyCode: 123123123,             // Ally code to watch the guild of
            //     channel:  channelID,             // The channel to log all this into
            //     sortBy:   "name" / "tickets",    // What to sort the list by (Defaults to name)
            //     tickets: 600,                    // The ticket count to consider players to be finished at (Defaults to the game's max of 600)
            //     updateType: "msg" / "update",    // Whether to send one message before the ticket reset, or update a message every 5min
            //
            //     // NOTE The following are automatically set (Not user-changeable)
            //     msgId: messageID,                    // The ID for the saved message, if we're updating it each time
            //     // NOTE This can help it not be checked constantly, for the msg type, so less game pulls
            //     nextChallengesRefresh: refreshTime,  // The last rawGuild.nextChallengesRefresh that was checked
            // }

            // Get the user's saved data
            const user = userMap.get(patron.discordID);

            // If the guild update isn't enabled, or is missing some needed info, move along
            const gt = user?.guildTickets;
            if (!gt?.enabled) continue;
            if (!gt?.allyCode) continue;
            if (!gt?.channel) continue;

            const MAX_TICKETS = gt?.tickets || 600;
            const isMsgType = gt?.updateType === "msg";

            // If it's a user that only wants the message right before reset, don't bother getting all the info together at other times.
            const refresh = Number.parseInt(gt.nextChallengesRefresh, 10);
            if (isMsgType && refresh && !this.isWithinTime(refresh, nowTime, 1, 5) && refresh > nowTime) {
                continue;
            }

            // Check if the bot is able to send messages into the set channel
            const chanAvail = await this.isChannelAvailable(gt.channel);

            // If the channel is not available, move on
            if (!chanAvail) continue;

            // Get any updates for the guild
            let rawGuild: RawGuild = null;
            try {
                rawGuild = await swgohAPI.getRawGuild(gt.allyCode, null, { forceUpdate: true });
            } catch (err) {
                const errStr = err instanceof Error ? err.message : String(err);
                if (errStr.includes("not in a guild")) continue;
                logger.error(`[patreonFuncs/guildsTickets] Issue getting the guild from ${gt.allyCode}: ${errStr}`);
                continue;
            }

            // Set the nextChallengesRefresh to avoid extra api calls in the future
            if (gt?.nextChallengesRefresh !== rawGuild?.nextChallengesRefresh && rawGuild?.nextChallengesRefresh) {
                gt.nextChallengesRefresh = rawGuild.nextChallengesRefresh;
            }

            if (!rawGuild?.roster?.length) {
                logger.error(
                    `[patreonFuncs/guildsTickets] Could not get the guild/ roster for ${gt.allyCode}, guild output: ${JSON.stringify(rawGuild)}`,
                );
                continue;
            }

            let roster = null;
            if (gt.sortBy === "tickets") {
                roster = rawGuild.roster.sort((a, b) =>
                    Number.parseInt(a.memberContribution[2]?.currentValue, 10) > Number.parseInt(b.memberContribution[2]?.currentValue, 10)
                        ? 1
                        : -1,
                );
            } else {
                roster = rawGuild.roster.sort((a, b) => (a.playerName.toLowerCase() > b.playerName.toLowerCase() ? 1 : -1));
            }

            let timeUntilReset = null;
            const refreshTime = Number.parseInt(rawGuild.nextChallengesRefresh, 10) * 1000;

            if (refreshTime > nowTime) {
                // It's in the future
                timeUntilReset = formatDuration(refreshTime - nowTime, Language.getLanguages()[defaultSettings.language]);
            } else {
                // It's in the past; use modulo to find time until the next daily reset
                // regardless of how stale the timestamp is
                timeUntilReset = formatDuration(
                    constants.dayMS - ((nowTime - refreshTime) % constants.dayMS),
                    Language.getLanguages()[defaultSettings.language],
                );
            }

            // If the user only wants the message, and we didn't have a saved refreshTime for them, check here
            if (isMsgType && !this.isWithinTime(refreshTime, nowTime, 1, 5)) {
                continue;
            }

            let maxed = 0;
            const outArr = [];
            for (const member of roster) {
                const tickets = member.memberContribution["2"].currentValue;
                if (tickets < MAX_TICKETS) {
                    outArr.push(expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${`**${member.playerName}**`}`));
                } else if (isMsgType || gt?.showMax) {
                    // Bold/ italicise the maxed players' counts
                    outArr.push(expandSpaces(`***\`${tickets.toString().padStart(3)}\`*** - ${`**${member.playerName}**`}`));
                } else {
                    maxed += 1;
                }
            }
            const timeTilString = `***Time until reset: ${timeUntilReset}***\n\n`;
            const maxedString = maxed > 0 ? `**${maxed}** members with ${MAX_TICKETS} tickets\n\n` : "";
            const outEmbed = {
                author: {
                    name: `${rawGuild.profile.name}'s Ticket Counts`,
                },
                description: `${timeTilString}${maxedString}${outArr.join("\n")}`,
                timestamp: new Date().toISOString(),
            };

            // If the user wants the messages just before each reset, send a new message instead of updating an old one
            //  - Just don't send the msg ID
            const sentMsg: Message = (await this.sendBroadcastMsg(
                gt?.updateType === "msg" ? null : gt.msgId,
                gt.channel,
                outEmbed,
            )) as Message;
            if (sentMsg && (!gt?.msgId || gt.msgId !== sentMsg.id)) {
                gt.msgId = sentMsg.id;
                user.guildTickets = gt;
                await userReg.updateUser(patron.discordID, user);
            }
        }
    }

    // Private helper methods

    private recordHistoryAtPayout(
        hist: ArenaHistEntry[] | undefined,
        rank: number | null | undefined,
        minLeft: number | null,
    ): ArenaHistEntry[] | undefined {
        // No rank means the account hasn't played this arena type — never write a null entry
        if (minLeft !== 0 || rank == null) return hist;
        return shouldWriteHistory(hist) ? updateArenaHistory(hist, rank) : hist;
    }

    private getPatreonTier(user: { amount_cents: number } | null): number {
        const patreonTiers = Object.keys(tiers).map((t) => Number.parseInt(t, 10));
        const amount_dollars = (user?.amount_cents || 0) / 100;
        const minTier = Math.min(...patreonTiers);

        // If no amount or less than minimum tier, return tier 0
        if (!amount_dollars || amount_dollars < minTier) return 0;

        let tierNum = minTier;
        for (const tier of patreonTiers) {
            if (amount_dollars >= tier) {
                tierNum = tier;
            } else {
                return tierNum;
            }
        }
        return tierNum;
    }

    // Get an array of all active patrons
    private async getActivePatrons(): Promise<ActivePatron[]> {
        const patrons = (await cache.get("swgohbot", "patrons", {})) as ActivePatron[];
        const others: string[] = Object.keys(env.PATRONS).length
            ? Object.keys(env.PATRONS).concat([env.DISCORD_OWNER_ID])
            : [env.DISCORD_OWNER_ID];
        for (const patUser of others) {
            const user = patrons.find((p) => p.discordID === patUser);
            if (!user) {
                patrons.push({
                    discordID: patUser,
                    amount_cents: env.PATRONS[patUser],
                });
            }
        }
        return patrons;
    }

    // Helper function to check if a channel is available and has proper permissions
    private async isChannelAvailable(channelId: string): Promise<boolean> {
        const channels = await this.client.shard.broadcastEval(
            async (client, { chanId }) => {
                const channel = client.channels.cache.get(chanId);
                if (
                    channel?.type === 0 && // 0 = GUILD_TEXT
                    channel?.guild &&
                    // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                    channel.permissionsFor(client.user).has(3072n)
                ) {
                    return true;
                }
                return false;
            },
            { context: { chanId: channelId } },
        );
        return channels.some((ch) => !!ch);
    }

    // Format the output for the payouts embed
    private formatPayouts(players: ArenaWatchAcct[], arena: "char" | "fleet") {
        const times = new Map<string, { players: ArenaWatchAcct[] }>();
        const arenaString = `last${toProperCase(arena === "fleet" ? "ship" : arena)}`;

        for (const player of players) {
            // A watched account may have no stored rank yet (fresh add, arena type not played)
            const rankString = (player[arenaString] ?? "N/A").toString().padStart(3);
            player.outString = expandSpaces(
                `**\`${constants.zws} ${rankString} ${constants.zws}\`** - ${player.mark ? `${player.mark} ` : ""}${player.name}`,
            );
            const existingTime = times.get(player.timeTil);
            if (existingTime) {
                existingTime.players.push(player);
            } else {
                times.set(player.timeTil, {
                    players: [player],
                });
            }
        }
        const fieldOut = [];
        for (const [key, time] of times.entries()) {
            fieldOut.push({
                name: `PO in ${key}`,
                value: time.players
                    .sort((a: ArenaWatchAcct, b: ArenaWatchAcct) => (a[arenaString] ?? 0) - (b[arenaString] ?? 0))
                    .map((p: ArenaWatchAcct) => p.outString)
                    .join("\n"),
            });
        }
        return {
            title: "Payout Schedule",
            description: "=".repeat(25),
            fields: fieldOut,
            timestamp: new Date().toISOString(),
        };
    }

    // Go through the given list and return how long til payouts
    private getPayoutTimes(players: ArenaWatchAcct[], arena: "char" | "fleet") {
        for (const player of players) {
            if (!player.poOffset && player.poOffset !== 0) continue;

            const timeLeft = getPayoutTimeLeft(player.poOffset, arena);
            player.duration = Math.floor(timeLeft / constants.minMS);
            player.timeTil = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;
        }
        return players.sort((a, b) => (a.duration > b.duration ? 1 : -1));
    }

    // Go through a given list and get the payout times for both arenas
    private getAllPayoutTimes(player: ArenaWatchAcct) {
        const payout = {
            poOffset: player.poOffset,
            charDuration: null,
            charTimeTil: null,
            fleetDuration: null,
            fleetTimeTil: null,
        };
        for (const arena of ["fleet", "char"] as const) {
            if (!payout.poOffset && payout.poOffset !== 0) continue;
            const timeLeft = getPayoutTimeLeft(player.poOffset, arena);
            payout[`${arena}Duration`] = Math.floor(timeLeft / constants.minMS);
            payout[`${arena}TimeTil`] = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;
        }
        return payout;
    }

    // Compare ranks to see if we have both sides of the fight or not
    private checkRanks(
        inArr: { allyCode: string; name: string; oldRank: number; newRank: number; mark: string }[],
        aw: UserConfig["arenaWatch"],
    ) {
        const checked = [];
        const outArr = [];
        if (aw.showvs) {
            // If the setting is on, show when the ranks match up
            for (let ix = 0; ix < inArr.length; ix++) {
                for (let jx = 0; jx < inArr.length; jx++) {
                    const isChecked = checked.includes(inArr[ix].allyCode) || checked.includes(inArr[jx].allyCode);
                    if (!isChecked && inArr[ix].oldRank === inArr[jx].newRank && inArr[ix].newRank === inArr[jx].oldRank) {
                        // Then they likely swapped spots
                        const ixName = inArr[ix].mark && aw.useMarksInLog ? `${inArr[ix].mark} ${inArr[ix].name}` : inArr[ix].name;
                        const jxName = inArr[jx].mark && aw.useMarksInLog ? `${inArr[jx].mark} ${inArr[jx].name}` : inArr[jx].name;
                        if (inArr[ix].oldRank > inArr[ix].newRank) {
                            outArr.push(`${ixName} has hit ${jxName} down from ${inArr[jx].oldRank} to ${inArr[jx].newRank}`);
                        } else {
                            outArr.push(`${jxName} has hit ${ixName} down from ${inArr[ix].oldRank} to ${inArr[ix].newRank}`);
                        }

                        // Put the players into the checked array so we can make sure not to log it twice
                        checked.push(inArr[ix].allyCode);
                        checked.push(inArr[jx].allyCode);
                    }
                }
            }
        }
        // Then check for anyone that wasn't matched up with a partner
        for (const player of inArr) {
            if (!checked.includes(player.allyCode)) {
                const pName = aw.useMarksInLog && player.mark ? `${player.mark} ${player.name}` : player.name;
                if (player.oldRank < player.newRank && aw.report !== "climb") {
                    outArr.push(`${pName} has dropped from ${player.oldRank} to ${player.newRank}`);
                } else if (player.oldRank > player.newRank && aw.report !== "drop") {
                    outArr.push(`${pName} has climbed from ${player.oldRank} to ${player.newRank}`);
                }
            }
        }
        return outArr;
    }

    // Send updated messages to the given channel, and edit an old message if able & one is supplied
    private async sendBroadcastMsg(msgId: string, channelId: string, outEmbed: Partial<Embed>) {
        // Use broadcastEval to check all shards for the channel, and if there's a valid message
        // there, edit it. If not, send a fresh copy of it.
        if (!channelId) return;
        const messages = await this.client.shard.broadcastEval(
            async (client, { msgIdIn, chanIn, outEmbed }) => {
                const channel = client.channels.cache.find((chan) => chan.id === chanIn || ("name" in chan && chan.name === chanIn));

                let msg: Message;
                let targetMsg: Message;
                if (
                    channel?.type === 0 && // 0 = GUILD_TEXT
                    channel?.guild &&
                    // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                    channel.permissionsFor(client.user).has(3072n)
                ) {
                    if (!msgIdIn) {
                        targetMsg = await channel.send({ embeds: [outEmbed] });
                    } else {
                        try {
                            msg = await channel.messages.fetch(msgIdIn);
                        } catch (_) {
                            msg = null;
                        }
                        if (msg) {
                            // @ts-expect-error  (Won't shut up about partial messages or void, etc)
                            targetMsg = await msg
                                .edit({ embeds: [outEmbed] })
                                .catch((err: unknown) =>
                                    logger.error(`[PF sendBroadcastMsg edit] ${err instanceof Error ? err.message : String(err)}`),
                                );
                        } else {
                            // @ts-expect-error  (Won't shut up about partial messages or void, etc)
                            targetMsg = await channel
                                .send({ embeds: [outEmbed] })
                                .catch((err: unknown) =>
                                    logger.error(`[PF sendBroadcastMsg send] ${err instanceof Error ? err.message : String(err)}`),
                                );
                        }
                    }
                }
                return targetMsg;
            },
            {
                context: {
                    msgIdIn: msgId,
                    chanIn: channelId,
                    outEmbed: outEmbed,
                },
            },
        );
        const msg = messages.filter((a) => !!a);
        return msg.length ? msg[0] : null;
    }

    private isWithinTime(targetTime: number, nowTime: number, min: number, max: number) {
        if (min >= max) throw new Error("[patreonFuncs / isWithinTime] Min MUST be less than max.");
        if (
            targetTime - min * constants.minMS < nowTime || // min minutes before targetTime is past
            targetTime - max * constants.minMS > nowTime
        ) {
            // max minutes before targetTime is in the future
            return false;
        }
        return true;
    }

    // Helper function to handle arena alerts for both character and ship arenas
    private async handleArenaAlerts(
        arenaType: "char" | "ship",
        player: PlayerArenaRes,
        acc: ArenaRankTracking,
        user: UserConfig,
        patron: { discordID: string },
        timeLeft: number,
        minTil: number,
        // Rank/climb as they stood at the start of the tick — see RankSnapshot
        prev: { rank: number; climb: number },
    ) {
        const arenaConfig = {
            char: {
                alertType: "both" as const,
                altType: "char" as const,
                rankKey: "lastCharRank" as const,
                climbKey: "lastCharClimb" as const,
                displayName: "character",
                capitalName: "Character",
            },
            ship: {
                alertType: "both" as const,
                altType: "fleet" as const,
                rankKey: "lastShipRank" as const,
                climbKey: "lastShipClimb" as const,
                displayName: "ship",
                capitalName: "Fleet",
            },
        };

        const config = arenaConfig[arenaType];
        const arenaData = arenaType === "char" ? player.arena?.char : player.arena?.ship;

        if (arenaData?.rank == null) return;

        if (
            user.arenaAlert &&
            user.arenaAlert.enableRankDMs !== "off" &&
            [config.alertType, config.altType].includes(user.arenaAlert.arena as "char" | "fleet" | "both")
        ) {
            const payoutTime = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;

            const pUser = await this.client.users.fetch(patron.discordID);
            if (pUser) {
                try {
                    // Payout warning
                    if (user.arenaAlert.payoutWarning > 0 && user.arenaAlert.payoutWarning === minTil) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: "Arena Payout Alert" },
                                        description: `${player.name}'s ${config.displayName} arena payout is in **${minTil}** minutes!${`\nYour current rank is ${arenaData.rank}`}`,
                                        color: constants.colors.green,
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[handleArenaAlerts] Failed to send payout warning: ${err}`));
                    }

                    // Payout result
                    if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: `${config.capitalName} arena` },
                                        description: `${player.name}'s payout ended at **${arenaData.rank}**!`,
                                        color: constants.colors.green,
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[handleArenaAlerts] Failed to send payout result: ${err}`));
                    }

                    // Rank drop alert
                    const lastRank = prev.rank;
                    const lastClimb = prev.climb;
                    if (arenaData.rank > lastRank && lastRank > 0) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: `${config.capitalName} Arena` },
                                        description: `**${player.name}'s** rank just dropped from ${lastRank} to **${arenaData.rank}**\nDown by **${
                                            arenaData.rank - lastClimb
                                        }** since last climb`,
                                        color: constants.colors.red,
                                        footer: { text: payoutTime },
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[handleArenaAlerts] Failed to send rank drop alert: ${err}`));
                    }
                } catch (e) {
                    logger.error(`[handleArenaAlerts] Error processing ${config.displayName} arena alerts: ${e}`);
                }
            }
        }

        // Update climb and rank tracking. Computed from the tick-start snapshot so a second
        // patron tracking the same account produces the identical (idempotent) result.
        acc[config.climbKey] = prev.climb ? (arenaData.rank < prev.rank ? arenaData.rank : prev.climb) : arenaData.rank;
        acc[config.rankKey] = arenaData.rank;
    }
}

// Create and export a singleton instance
const patreonFuncs = new PatreonFuncs();

/**
 * Fetches a player's data from the SWGOH API with patreon-aware cooldown.
 * Returns null on any error — the caller is responsible for the error reply.
 *
 * Usage:
 *   const player = await fetchPlayerWithCooldown(interaction, allyCode);
 *   if (!player?.roster) return super.error(interaction, "...");
 */
export async function fetchPlayerWithCooldown(
    interaction: ChatInputCommandInteraction,
    allyCode: number | string,
): Promise<SWAPIPlayer | null> {
    const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);
    try {
        return await swgohAPI.player(allyCode, cooldown);
    } catch (e) {
        logger.error(`[fetchPlayerWithCooldown] Error fetching player ${allyCode}: ${e}`);
        return null;
    }
}

export default patreonFuncs;
export { PatreonFuncs };
