import type { APIEmbed, ChatInputCommandInteraction, Client, Message } from "discord.js";
import Language from "../base/Language.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import { PRIORITY, type Priority } from "../data/constants/swapiServe.ts";
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
import {
    chunkArray,
    expandSpaces,
    formatDuration,
    getPayoutTimeLeft,
    isArenaChannelOn,
    msgArray,
    toProperCase,
    wait,
} from "./functions.ts";
import { getGuildSupporterTier } from "./guildConfig/patreonSettings.ts";
import logger from "./Logger.ts";
import swgohAPI from "./swapi.ts";
import userReg from "./users.ts";

export function updateArenaHistory(hist: ArenaHistEntry[] | undefined, rank: number, now: number = Date.now()): ArenaHistEntry[] {
    const entries = hist ? [...hist] : [];
    entries.push({ rank, ts: now });
    entries.sort((a, b) => a.ts - b.ts);
    while (entries.length > 90) entries.shift(); // oldest entries are always at index 0 after sort
    return entries;
}

// Returns true when a new payout entry should be written. Prevents duplicate entries when
// the poll cycle fires multiple times within the same payout minute.
export function shouldWriteHistory(hist: ArenaHistEntry[] | undefined, now: number = Date.now()): boolean {
    if (!hist?.length) return true;
    // updateArenaHistory always persists a sorted array, so at(-1) is the newest entry.
    const lastTs = hist.at(-1)?.ts ?? 0;
    return now - lastTs > 5 * constants.minMS;
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

    // dates[0] = (windowDays-1) days ago ... dates[last] = today
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
        title: `Arena Rank - Last ${windowDays} Days - ${label}`,
        width: 800,
        height: 400,
        pointLabels: true,
    };
}

// The rank/climb fields handleArenaAlerts updates on the arenaPlayers doc
type ArenaRankTracking = Pick<ArenaPlayer, "lastCharRank" | "lastCharClimb" | "lastShipRank" | "lastShipClimb">;

// Ranks as they stood at the start of an arenaTick. Multiple patrons can track the same
// ally code (and one patron can both register and watch it), so change detection must
// compare against this snapshot rather than the live docs - otherwise the first consumer
// to update a doc suppresses the same rank change for everyone after it.
export type RankSnapshot = Map<number, ArenaRankTracking>;

// A single arena rank change, collected per account and fed to checkRanks for log formatting
// `missed` is set when the rank moved across ticks we observed but never announced to this
// watcher (a skipped/failed send). processShardPatron reads it after checkRanks to decide
// whether the outgoing message needs the "net change" footer.
type ArenaRankChange = { allyCode: number; name: string; oldRank: number; newRank: number; mark?: string; missed?: boolean };

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
            // mention/poOffset can be absent on migrated entries - normalize them here so the
            // hydrated account always satisfies ArenaWatchAcct
            mention: entry.mention ?? null,
            mark: entry.mark ?? undefined,
            poOffset: entry.poOffset ?? 0,
            name: doc?.name || String(entry.allyCode),
            lastChar: doc?.lastCharRank ?? null,
            lastShip: doc?.lastShipRank ?? null,
        };
    });
}

const tiers: Record<
    number,
    {
        name: string;
        benefits: Record<string, string> | null;
        playerTime: number;
        guildTime: number;
        sharePlayer?: number;
        shareGuild?: number;
        awAccounts?: number;
    }
> = patreonModule.tiers;

// Patron tier thresholds (in cents)
const TIER_1_CENTS = 100; // $1
const TIER_5_CENTS = 500; // $5
const TIER_10_CENTS = 1000; // $10

// What came of a sendToChannel call. FAILED and UNDELIVERABLE are deliberately distinct: callers
// that hold per-watcher state until delivery (processShardPatron's announce anchors) must retry a
// FAILED send but must not wait on an UNDELIVERABLE one, which no later tick can change on its own.
// `enum` is unavailable here - tsconfig sets erasableSyntaxOnly, since the bot runs TypeScript
// natively with no compile step - so this is the usual const-object-plus-derived-union.
export const SEND_OUTCOME = {
    // A shard reported the message as delivered
    SENT: "sent",
    // Attempted and threw (Discord error, shard timeout). Transient, so retrying is worthwhile.
    FAILED: "failed",
    // No shard has a channel we can post in: deleted, bot removed from the guild, or ViewChannel /
    // SendMessages revoked. A standing condition, so retrying it every tick changes nothing.
    UNDELIVERABLE: "undeliverable",
} as const;

export type SendOutcome = (typeof SEND_OUTCOME)[keyof typeof SEND_OUTCOME];

// Discord API error codes where a resend cannot succeed: the recipient or target refuses the
// message as a matter of configuration, not a transient fault. Retrying these across the rest of
// an alert window repeats a guaranteed failure (and an error log line) every cycle, forever.
const UNDELIVERABLE_DISCORD_CODES = new Set([
    10003, // Unknown Channel - deleted since we last looked
    10013, // Unknown User
    50001, // Missing Access
    50007, // Cannot send messages to this user - DMs closed, or the bot is blocked
    50013, // Missing Permissions
]);

/**
 * Classifies a thrown send error. discord.js puts a numeric `code` on DiscordAPIError; anything
 * without one (network blip, timeout, shard error, a plain Error) is transient and worth retrying.
 */
export function classifySendError(err: unknown): SendOutcome {
    const code = (err as { code?: unknown } | null)?.code;
    return typeof code === "number" && UNDELIVERABLE_DISCORD_CODES.has(code) ? SEND_OUTCOME.UNDELIVERABLE : SEND_OUTCOME.FAILED;
}

// The character and fleet arenas run identical channel-log logic over different document fields,
// setting tokens and wording. This table holds everything that varies, so processShardPatron can
// walk both arenas on one code path - the same shape as the arenaConfig table handleArenaAlerts
// already uses for the DM path. Keeping them on one path is what stops the two drifting: as
// hand-written copies they had already diverged in statement order, which reads as a deliberate
// difference when it is not one.
const ARENAS = ["char", "fleet"] as const;
type ArenaKind = (typeof ARENAS)[number];

const ARENA_LOG_CONFIG: Record<
    ArenaKind,
    {
        // Key into the API player's `arena` object - the game calls the fleet arena "ship"
        apiKey: "char" | "ship";
        // Values of a watch entry's warn.arena / result that select this arena
        settingNames: readonly string[];
        // arenaPlayers doc fields
        docRankKey: "lastCharRank" | "lastShipRank";
        docChangeKey: "lastCharChange" | "lastShipChange";
        histKey: "charHist" | "shipHist";
        // Hydrated watch-entry (ArenaWatchAcct) fields
        acctRankKey: "lastChar" | "lastShip";
        acctChangeKey: "lastCharChange" | "lastShipChange";
        announcedKey: "lastCharAnnounced" | "lastShipAnnounced";
        // Per-cycle payout marker fields on the stored watch entry
        warnMark: "charWarn" | "fleetWarn";
        resultMark: "charResult" | "fleetResult";
        // Wording, kept here so both arenas' phrasing is visible side by side
        header: string;
        resultSuffix: string;
        warnLabel: string;
    }
> = {
    char: {
        apiKey: "char",
        settingNames: ["char", "both"],
        docRankKey: "lastCharRank",
        docChangeKey: "lastCharChange",
        histKey: "charHist",
        acctRankKey: "lastChar",
        acctChangeKey: "lastCharChange",
        announcedKey: "lastCharAnnounced",
        warnMark: "charWarn",
        resultMark: "charResult",
        header: "**Character Arena:**",
        resultSuffix: "in character arena",
        warnLabel: "**character**",
    },
    fleet: {
        apiKey: "ship",
        settingNames: ["fleet", "both"],
        docRankKey: "lastShipRank",
        docChangeKey: "lastShipChange",
        histKey: "shipHist",
        acctRankKey: "lastShip",
        acctChangeKey: "lastShipChange",
        announcedKey: "lastShipAnnounced",
        warnMark: "fleetWarn",
        resultMark: "fleetResult",
        header: "**Fleet Arena:**",
        resultSuffix: "in fleet arena",
        warnLabel: "**fleet**",
    },
};

// How long after a payout the "payout ended" result / payout history may still fire. Gives the
// once-per-cycle result alert (and history write) a few ticks of slack to self-heal a dropped
// fetch on the payout minute, without acting on a stale payout hours later (e.g. after an outage).
const PAYOUT_RESULT_WINDOW_MS = 5 * constants.minMS;

// How many minutes past the configured warn minute a dropped tick may still be recovered. Same
// idea as PAYOUT_RESULT_WINDOW_MS, but the warn side needs the explicit bound: `minTil <= warnMin`
// alone stays true all the way to payout, so a gap through the real warn minute (outage, restart,
// or a watcher with no marker yet) would fire "payout is in 400 minutes" at whatever minute we
// came back on.
const WARN_CATCHUP_MIN = 5;

// True on the first tick at or just past the configured warn minute, and never once payout has
// passed. Shared by the channel (processShardPatron) and DM (handleArenaAlerts) warn paths so the
// two agree on what counts as "close enough" to the warn minute.
export function isInWarnWindow(minTil: number, warnMin: number | undefined): boolean {
    if (!warnMin || warnMin <= 0) return false;
    return minTil > 0 && minTil <= warnMin && minTil > warnMin - WARN_CATCHUP_MIN;
}

// Cycle math shared by the DM (handleArenaAlerts), channel (processShardPatron) and history
// paths, all keyed off one tick timestamp so they agree on which payout cycle a tick belongs to.
// - nextPayout: the upcoming payout instant (stable across the pre-payout window)
// - lastPayout: the most recent payout instant, i.e. the cycle id for post-payout events
// - minTil: whole minutes until payout (matches the old floored display value)
// - justAfterPayout: true only within PAYOUT_RESULT_WINDOW_MS after payout, so result/history
//   self-heal a dropped minute without firing before payout or long after it
export function payoutCycleInfo(
    now: number,
    timeLeft: number,
): { nextPayout: number; lastPayout: number; minTil: number; justAfterPayout: boolean } {
    const nextPayout = now + timeLeft;
    const lastPayout = nextPayout - constants.dayMS;
    return {
        nextPayout,
        lastPayout,
        minTil: Math.floor(timeLeft / constants.minMS),
        justAfterPayout: now - lastPayout <= PAYOUT_RESULT_WINDOW_MS,
    };
}

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

    // Priority is required rather than defaulted: arenaTick and shardTimes both use this, and
    // they sit in different tiers because only one of them loses data by being late.
    private async buildPlayerMap(allyCodes: number[], priority: Priority): Promise<Map<number, PlayerArenaRes>> {
        const map = new Map<number, PlayerArenaRes>();
        if (!allyCodes.length) return map;
        const chunks = chunkArray(allyCodes, 50);
        for (const chunk of chunks) {
            let attempts = 0;
            while (attempts < 3) {
                try {
                    const results = await swgohAPI.getPlayersArena(chunk, priority);
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
                awAccounts: currentTier.awAccounts ?? 0,
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
            awAccounts: currentTier.awAccounts ?? 0,
        };
    }

    // Get the cooldown for the given player
    //  - If the user is a Patreon subscriber or someone in their server selected it as their bonus
    //      * Give them the best lowered times available to them
    //  - If the user isn't a subscriber, and no one in their server selected it
    //      * Give them the defaults set in the data/patreon.js file
    /**
     * The queue tier a user-initiated command should run at.
     *
     * Both signals are checked, matching getPlayerCooldown: the caller may be a patron
     * themselves, or may be in a server someone else selected as their bonus server. Missing the
     * second case would put a supporter's whole guild on the public tier.
     */
    async commandPriority(userId: string, guildId?: string): Promise<Priority> {
        if (await this.getPatronUser(userId)) return PRIORITY.SUPPORTER_COMMAND;
        const supporterTier = await getGuildSupporterTier({ guildId });
        return supporterTier > 0 ? PRIORITY.SUPPORTER_COMMAND : PRIORITY.PUBLIC_COMMAND;
    }

    async getPlayerCooldown(userId: string, guildId?: string): Promise<{ player: number; guild: number }> {
        const patron = await this.getPatronUser(userId);

        // This will give the highest/ combined tier that anyone has set for the server, or 0 if none
        const supporterTier = await getGuildSupporterTier({ guildId });

        // Grab the best times available based on the supporterTier
        const supporterTimes: { playerTime: number; guildTime: number } = !tiers?.[supporterTier]?.sharePlayer
            ? tiers[0]
            : {
                  playerTime: tiers[supporterTier].sharePlayer ?? 0,
                  guildTime: tiers[supporterTier].shareGuild ?? 0,
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
        // One timestamp per arenaTick so every patron watching an account derives the same
        // payout cycle id (defaults to now for standalone/test callers)
        now: number = Date.now(),
    ): Promise<boolean> {
        // True when a DM warn/result marker was written to user.arenaAlert.alerted, so arenaTick
        // knows to persist the user doc
        let userChanged = false;
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

            // In-memory defaults only - not marked changed; they persist alongside the next real change
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
            // run DM alerts in a single pass per arena type - both need the same payout cycle,
            // so derive it once from the shared tick `now` and share it, which also keeps the
            // history write and the alert on the same cycle id.
            // Live data can omit the payout offset - without it the payout math would go NaN,
            // so payout history/alerts are skipped (null) while rank tracking still runs
            if (typeof player.poUTCOffsetMinutes !== "number") {
                logger.log(`[processArenaAlerts] Missing poUTCOffsetMinutes for ${allyCode}; skipping payout history & payout alerts`);
            }
            for (const arenaType of ["char", "ship"] as const) {
                const arenaData = arenaType === "char" ? player.arena.char : player.arena.ship;
                if (arenaData?.rank == null) continue;
                const timeLeft =
                    typeof player.poUTCOffsetMinutes === "number"
                        ? getPayoutTimeLeft(player.poUTCOffsetMinutes, arenaType === "char" ? "char" : "fleet", now)
                        : null;
                const cycle = timeLeft === null ? null : payoutCycleInfo(now, timeLeft);

                const histKey = arenaType === "char" ? "charHist" : "shipHist";
                const newHist = this.recordHistoryAtPayout(playerDoc[histKey], arenaData.rank, cycle?.justAfterPayout ?? false, now);
                if (newHist !== playerDoc[histKey]) {
                    playerDoc[histKey] = newHist;
                    changedCodes.add(allyCode);
                }

                const rankKey = arenaType === "char" ? "lastCharRank" : "lastShipRank";
                const climbKey = arenaType === "char" ? "lastCharClimb" : "lastShipClimb";
                const prevRank = playerDoc[rankKey];
                const prevClimb = playerDoc[climbKey];

                // Rank-drop DMs compare against the tick-start snapshot, not the live doc - another
                // patron tracking the same account may have already updated the doc this tick
                const snap = rankSnapshot.get(allyCode);
                userChanged =
                    (await this.handleArenaAlerts(
                        arenaType,
                        player,
                        playerDoc,
                        user,
                        patron,
                        timeLeft,
                        {
                            rank: snap?.[rankKey] ?? 0,
                            climb: snap?.[climbKey] ?? 0,
                        },
                        now,
                    )) || userChanged;

                if (playerDoc[rankKey] !== prevRank || playerDoc[climbKey] !== prevClimb) {
                    changedCodes.add(allyCode);
                }
            }

            arenaPlayerMap.set(allyCode, playerDoc);
        }
        // Rank/history changes flush via arenaPlayerMap; the user doc is only dirty when a DM
        // warn/result marker was written this tick - arenaTick persists it when userChanged is true
        return userChanged;
    }

    // Single per-minute arena cycle: batch-fetch all ally codes, then run alerts and shard processing
    async arenaTick(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const eligibleIds = patrons.filter((p) => p.amount_cents >= TIER_1_CENTS).map((p) => p.discordID);
        const userMap = await userReg.getUsersByIds(eligibleIds);
        const allyCodes = collectAllyCodes(patrons, userMap);
        // Top tier: a tick that runs past its minute trips the arenaTickRunning guard in
        // clientReady, and because the payout cycle and the poll interval are exact multiples,
        // the same minute is then lost every day for whichever accounts pay out in it.
        const playerMap = await this.buildPlayerMap(allyCodes, PRIORITY.ARENA_TICK);
        const arenaPlayerMap = await arenaPlayerRegistry.batchGet(allyCodes);
        // Freeze the tick-start ranks before any consumer mutates the shared docs, so every
        // patron tracking an account sees the same rank change
        const rankSnapshot = buildRankSnapshot(arenaPlayerMap);
        const changedCodes = new Set<number>();
        // One timestamp for the whole tick so every patron watching an account derives the
        // same payout cycle id (see handleArenaAlerts once-per-cycle gating)
        const now = Date.now();

        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user = userMap.get(patron.discordID);
            if (!user) continue;
            // Both consumers mutate the same user object (DM markers / watch-entry markers) and
            // report whether they did; persist it once per patron so we don't double-write the doc.
            let userChanged = false;
            if (user.accounts?.length) {
                userChanged =
                    (await this.processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot, now).catch(
                        (err) => {
                            logger.error(
                                `[arenaTick] processArenaAlerts error for ${patron.discordID}: ${err instanceof Error ? err.message : String(err)}`,
                            );
                            return false;
                        },
                    )) || userChanged;
            }
            userChanged =
                (await this.processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot, now).catch((err) => {
                    logger.error(
                        `[arenaTick] processShardPatron error for ${patron.discordID}: ${err instanceof Error ? err.message : String(err)}`,
                    );
                    return false;
                })) || userChanged;
            if (userChanged) {
                await userReg
                    .updateUser(patron.discordID, user)
                    .catch((err) =>
                        logger.error(
                            `[arenaTick] updateUser error for ${patron.discordID}: ${err instanceof Error ? err.message : String(err)}`,
                        ),
                    );
            }
        }

        // Only write docs that actually changed this tick - the map holds every loaded doc
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
                isArenaChannelOn(aw.payout?.char)
                    ? (this.sendBroadcastMsg(
                          aw.payout.char.msgID,
                          aw.payout.char.channel,
                          this.formatPayouts(this.getPayoutTimes(players, "char"), "char"),
                      ) as Promise<Message>)
                    : Promise.resolve(null),
                isArenaChannelOn(aw.payout?.fleet)
                    ? (this.sendBroadcastMsg(
                          aw.payout.fleet.msgID,
                          aw.payout.fleet.channel,
                          this.formatPayouts(this.getPayoutTimes(players, "fleet"), "fleet"),
                      ) as Promise<Message>)
                    : Promise.resolve(null),
            ]);
            // The payout msgIDs are the only fields this loop owns, so write just those paths.
            // A whole-doc updateUser here would `$set` this loop's arenaWatch snapshot, which was
            // loaded up to five minutes ago - rolling back the per-cycle payout markers and
            // last-announced ranks arenaTick has written on its own interval since, and re-firing
            // warn/result alerts that had already been sent.
            const msgIdFields: Record<string, string> = {};
            if (charMsg) msgIdFields["arenaWatch.payout.char.msgID"] = charMsg.id;
            if (fleetMsg) msgIdFields["arenaWatch.payout.fleet.msgID"] = fleetMsg.id;
            if (Object.keys(msgIdFields).length) {
                await userReg.updateUserFields(patron.discordID, msgIdFields);
            }
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
        // One timestamp per arenaTick so payout cycle ids line up with the DM path
        now: number = Date.now(),
    ): Promise<boolean> {
        if (!user?.arenaWatch) return false;
        const aw = user.arenaWatch;

        // Fill in missing arena sub-configs with disabled defaults so the rest of the function
        // can safely access their properties without crashing on old/partial DB records.
        aw.arena ??= { char: { channel: "", enabled: false }, fleet: { channel: "", enabled: false } };
        aw.arena.char ??= { channel: "", enabled: false };
        aw.arena.fleet ??= { channel: "", enabled: false };
        // After the normalization above both sub-configs exist; capture them in consts so the
        // definite type survives into the broadcastEval closures (which otherwise re-widen to optional).
        const arenaChar = aw.arena.char;
        const arenaFleet = aw.arena.fleet;
        // Same two configs keyed by arena, so the per-arena loops below can look one up without
        // re-widening to optional the way indexing aw.arena does
        const arenaCfg: Record<ArenaKind, typeof arenaChar> = { char: arenaChar, fleet: arenaFleet };

        // Whether each arena's log is usable at all. Everything posted for an arena - rank changes
        // AND payout warn/result - goes to that arena's own log channel and requires it, so a
        // disabled arena never contributes a line to any message.
        const logOn: Record<ArenaKind, boolean> = { char: isArenaChannelOn(arenaChar), fleet: isArenaChannelOn(arenaFleet) };

        // Somewhere to post to, not something waiting to be posted. Per-arena rather than the old
        // cross-arena test, which counted a channel on one arena plus `enabled` on the other.
        const anyLogOn = logOn.char || logOn.fleet;
        // The /arenawatch payout setting: the standing per-account payout-times message that
        // shardTimes() posts and re-edits. NOT the per-account payout warn/result lines - those
        // belong to the arena log and ride on logOn[arena]. Only checked here because these
        // watchers still need their poOffset backfilled below.
        const payoutTimesOn = isArenaChannelOn(aw.payout?.char) || isArenaChannelOn(aw.payout?.fleet);

        // Nothing to post and nothing to maintain, so skip
        if (!anyLogOn && !payoutTimesOn) return false;

        const acctCount = getAwAcctCount(patron.amount_cents);
        // Hydrate names/ranks from the arenaPlayers docs so every account has a usable name
        // and the persisted rank seeded before the payout/warn logic below runs
        const accountsToCheck = hydrateWatchAccounts(aw.allyCodes.slice(0, acctCount), arenaPlayerMap);
        if (!accountsToCheck.length) return false;

        // report="none" silences rank-change lines only, so a watcher can keep the log channel for
        // payout warn/result alone. Announce anchors are tracked only when rank alerts can actually
        // be posted, so a watcher who wants no rank lines doesn't rewrite their user doc every tick.
        const rankAlertsOn = aw.report !== "none";

        // Everything accumulated per arena across the account loop, then sent and committed below.
        // - pendingMark: payout warn/result cycle markers. Committed ONLY on a delivered message, so
        //   a failed send is retried next tick within its window rather than silently suppressed.
        // - pendingAnnounce: the last-announced rank anchor. Committed on delivery too, but also when
        //   no send was attempted for that arena (the change was filtered out by aw.report, or the
        //   channel is undeliverable) - pinning the anchor there would wedge the account's alerts
        //   against a stale baseline.
        const arenaState: Record<
            ArenaKind,
            {
                rankOn: boolean;
                comp: ArenaRankChange[];
                out: string[];
                pendingMark: { allyCode: number; field: "charWarn" | "charResult" | "fleetWarn" | "fleetResult"; cycle: number }[];
                pendingAnnounce: { allyCode: number; rank: number }[];
                fields: string[];
                missed: boolean;
                // See the send block: `attempted` false means no later tick would post this anyway
                attempted: boolean;
                sent: boolean;
            }
        > = {
            char: {
                rankOn: logOn.char && rankAlertsOn,
                comp: [],
                out: [],
                pendingMark: [],
                pendingAnnounce: [],
                fields: [],
                missed: false,
                attempted: false,
                sent: false,
            },
            fleet: {
                rankOn: logOn.fleet && rankAlertsOn,
                comp: [],
                out: [],
                pendingMark: [],
                pendingAnnounce: [],
                fields: [],
                missed: false,
                attempted: false,
                sent: false,
            },
        };

        // Stored watch entries by ally code, and whether we mutated any of them this tick (poOffset
        // backfill, announce-baseline seed, or a delivered marker). Declared up front so the loop can
        // freeze a first-alert announce baseline before the send is attempted.
        const storedByCode = new Map(user.arenaWatch.allyCodes.map((a) => [a.allyCode, a]));
        let userChanged = false;

        // Go through all the listed players, and see if any of them have shifted arena rank or payouts incoming
        for (const player of accountsToCheck) {
            const newPlayer = playerMap.get(player.allyCode) ?? null;
            if (!newPlayer?.arena?.char?.rank && !newPlayer?.arena?.ship?.rank) {
                // Both, since low level players can have just char arena I believe
                continue;
            }
            // Refresh the name only when the API provides a non-empty one
            if (newPlayer.name) {
                player.name = newPlayer.name;
            }
            // Only adopt the API offset when it is actually a number. Live data can omit
            // poUTCOffsetMinutes (the DM path guards the same case); copying the undefined through
            // would clobber the good stored offset and drop the account off the payout schedule
            // until a later tick restored it.
            if (typeof newPlayer.poUTCOffsetMinutes === "number" && player.poOffset !== newPlayer.poUTCOffsetMinutes) {
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

            // prevObs = last OBSERVED rank (shared, tick-start snapshot). Advancing the observed
            // rank on the doc feeds history / the payout list / DM alerts.
            const snap = rankSnapshot.get(player.allyCode);

            // Rank alerts use the bare name; payout warn/result may prefix the watcher's mark
            const nameForRank = player.mention ? `<@${player.mention}>` : player.name;
            const pName = aw.useMarksInLog && player.mark ? `${player.mark} ${nameForRank}` : nameForRank;

            // Payout timing for this account, keyed off the shared tick `now`. Null when the offset
            // is unknown (live data can omit it), in which case payout history/alerts are skipped.
            const poOff = typeof player.poOffset === "number" ? player.poOffset : null;

            for (const arena of ARENAS) {
                const cfg = ARENA_LOG_CONFIG[arena];
                const st = arenaState[arena];
                const prevObs = snap?.[cfg.docRankKey] ?? 0;
                const cur = newPlayer.arena?.[cfg.apiKey]?.rank ?? null;
                if (cur != null) player[cfg.acctRankKey] = cur;

                if (cur != null && cur !== prevObs) {
                    player[cfg.acctChangeKey] = prevObs - cur;
                    playerDoc[cfg.docRankKey] = cur;
                    playerDoc[cfg.docChangeKey] = player[cfg.acctChangeKey];
                    changedCodes.add(player.allyCode);
                }

                // Channel rank alerts anchor on the rank we last ANNOUNCED to this watcher, not the
                // observed rank, so a failed/skipped send is recovered by the next alert covering
                // the whole span. If the observed rank had already moved past what we announced, the
                // change bundles updates this watcher never saw - flag it so checkRanks can say so.
                // anchor 0 means no baseline yet (brand-new account, never observed or announced) -
                // skip the noise "rank 0 -> X" alert, matching the DM path's `lastRank > 0` guard.
                // The observed rank persists above, so the next real change has a real baseline.
                if (st.rankOn && cur != null) {
                    const announced = player[cfg.announcedKey];
                    const anchor = announced ?? prevObs;
                    if (cur !== anchor && anchor > 0) {
                        // Freeze the announce baseline before the send so a failed first alert (no
                        // prior announced rank) is retried next tick; delivery advances it to `cur`.
                        if (announced == null) {
                            const stored = storedByCode.get(player.allyCode);
                            if (stored) {
                                stored[cfg.announcedKey] = anchor;
                                userChanged = true;
                            }
                        }
                        st.comp.push({
                            name: nameForRank,
                            allyCode: player.allyCode,
                            oldRank: anchor,
                            newRank: cur,
                            mark: player.mark,
                            missed: announced != null && announced !== prevObs,
                        });
                        st.pendingAnnounce.push({ allyCode: player.allyCode, rank: cur });
                    }
                }

                const cycle = poOff === null ? null : payoutCycleInfo(now, getPayoutTimeLeft(poOff, arena, now));

                // Record payout history for all arenaWatch accounts, regardless of notification settings
                const newHist = this.recordHistoryAtPayout(
                    playerDoc[cfg.histKey],
                    player[cfg.acctRankKey],
                    cycle?.justAfterPayout ?? false,
                    now,
                );
                if (newHist !== playerDoc[cfg.histKey]) {
                    playerDoc[cfg.histKey] = newHist;
                    changedCodes.add(player.allyCode);
                }

                // Payout warn/result: once per payout cycle, keyed on the payout instant
                // (per-watcher markers) so a dropped warning-minute / payout tick self-heals within
                // its window instead of being lost to an exact-minute check. Markers are applied on
                // send success. These post to the same per-arena log channel as the rank lines, so
                // an arena whose log is off has nowhere to deliver them - don't build (and re-build
                // every tick for the whole window) lines that can never be sent.
                const rank = player[cfg.acctRankKey];
                if (!logOn[arena] || !cycle || rank == null) continue;
                if (
                    cfg.settingNames.includes(player.result ?? "") &&
                    cycle.justAfterPayout &&
                    player.alerted?.[cfg.resultMark] !== cycle.lastPayout
                ) {
                    st.out.push(`${pName} finished at ${rank} ${cfg.resultSuffix}`);
                    st.pendingMark.push({ allyCode: player.allyCode, field: cfg.resultMark, cycle: cycle.lastPayout });
                }
                if (
                    cfg.settingNames.includes(player.warn?.arena ?? "") &&
                    isInWarnWindow(cycle.minTil, player.warn?.min) &&
                    player.alerted?.[cfg.warnMark] !== cycle.nextPayout
                ) {
                    st.out.push(`${pName}'s ${cfg.warnLabel} arena payout is in ${cycle.minTil} minutes`);
                    st.pendingMark.push({ allyCode: player.allyCode, field: cfg.warnMark, cycle: cycle.nextPayout });
                }
            }

            arenaPlayerMap.set(player.allyCode, playerDoc);
        }

        // A single subtext footer when any line bundles updates we observed but never posted, so
        // the net numbers aren't mistaken for a single move. Kept short so it stays on one line.
        const MISSED_FOOTER = "-# Some ranks moved more than once since our last post; the numbers show the net change.";

        for (const arena of ARENAS) {
            const st = arenaState[arena];
            // st.comp is only populated when the arena's channel alerts are on (see the loop).
            // checkRanks applies the aw.report climb/drop filter, so it can return nothing even for
            // a non-empty comp list - the footer keys off its output, not the raw changes. A message
            // carrying only payout warn/result lines has no net-change numbers to caveat.
            const rankLines = st.comp.length ? this.checkRanks(st.comp, aw) : [];
            st.missed = rankLines.length > 0 && st.comp.some((c) => c.missed);
            const out = st.out.concat(rankLines);
            if (out.length) {
                st.fields.push(ARENA_LOG_CONFIG[arena].header);
                st.fields.push(out.map((c) => `- ${c}`).join("\n"));
            }
        }

        // Per-arena send outcome. `attempted` is false when nothing was posted for that arena and
        // no later tick would change that - either there was nothing to say (all changes filtered
        // out by aw.report, or its log is off) or the channel is UNDELIVERABLE. Neither is a
        // delivery failure, so the announce anchors below still advance; pinning them on a channel
        // no shard can see would rebuild and re-broadcast the same alert every tick indefinitely.
        // An arena only ever contributes lines when its own log is on (logOn[arena]), so non-empty
        // fields are themselves proof that arena is enabled with a channel - no branch here needs
        // to re-check `enabled`, and both branches agree on a disabled arena.
        if (ARENAS.some((arena) => arenaState[arena].fields.length)) {
            if (arenaChar.channel && arenaChar.channel === arenaFleet.channel) {
                // If they're both set to the same channel, send it all in one message
                const fields = ARENAS.flatMap((arena) => arenaState[arena].fields);
                if (ARENAS.some((arena) => arenaState[arena].missed)) fields.push(MISSED_FOOTER);
                const outcome = await this.sendToChannel(arenaChar.channel, `>>> ${fields.join("\n")}`);
                // One message carries both arenas, but only the arena that contributed lines to it
                // can count as delivered
                for (const arena of ARENAS) {
                    const st = arenaState[arena];
                    st.attempted = st.fields.length > 0 && outcome !== SEND_OUTCOME.UNDELIVERABLE;
                    st.sent = outcome === SEND_OUTCOME.SENT && st.fields.length > 0;
                }
            } else {
                // Else they each have their own channels, so send em there (sendToChannel never
                // rejects - it resolves an outcome either way - so Promise.all is safe here)
                for (const arena of ARENAS) {
                    const st = arenaState[arena];
                    if (st.missed) st.fields.push(MISSED_FOOTER);
                }
                const outcomes = await Promise.all(
                    ARENAS.map((arena) =>
                        arenaState[arena].fields.length
                            ? this.sendToChannel(arenaCfg[arena].channel, `>>> ${arenaState[arena].fields.join("\n")}`)
                            : Promise.resolve<SendOutcome>(SEND_OUTCOME.UNDELIVERABLE),
                    ),
                );
                ARENAS.forEach((arena, ix) => {
                    const st = arenaState[arena];
                    st.attempted = st.fields.length > 0 && outcomes[ix] !== SEND_OUTCOME.UNDELIVERABLE;
                    st.sent = outcomes[ix] === SEND_OUTCOME.SENT;
                });
            }
        }

        // Persist per-watcher state on the user doc: poOffset backfill always, plus the announce /
        // payout markers for whichever channel delivered. rank/history live in arenaPlayers.
        for (const acct of accountsToCheck) {
            const stored = storedByCode.get(acct.allyCode);
            if (stored && stored.poOffset !== acct.poOffset) {
                stored.poOffset = acct.poOffset;
                userChanged = true;
            }
        }

        for (const arena of ARENAS) {
            const st = arenaState[arena];
            // Payout markers: only a delivered message counts, so an undelivered warn/result
            // retries on the next tick inside its window.
            if (st.sent) {
                for (const p of st.pendingMark) {
                    const stored = storedByCode.get(p.allyCode);
                    if (!stored) continue;
                    stored.alerted ??= {};
                    stored.alerted[p.field] = p.cycle;
                    userChanged = true;
                }
            }
            // Announce anchors: advance unless a send was attempted and failed. Holding the anchor
            // back when nothing was posted (aw.report filtered the line out, or the channel is gone)
            // would leave every later alert measured from a rank the watcher has long since moved
            // past - and with report=climb/drop it would suppress that account's alerts indefinitely.
            if (st.attempted && !st.sent) continue;
            const field = ARENA_LOG_CONFIG[arena].announcedKey;
            for (const p of st.pendingAnnounce) {
                const stored = storedByCode.get(p.allyCode);
                if (stored && stored[field] !== p.rank) {
                    stored[field] = p.rank;
                    userChanged = true;
                }
            }
        }
        // arenaTick persists the user doc once per patron when userChanged is true (see the loop),
        // so both consumers avoid double-writing the same doc.
        return userChanged;
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
            let guild: SWAPIGuild | null = null;
            try {
                guild = await swgohAPI.guild(gu.allyCode, undefined, PRIORITY.BACKGROUND);
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
                guildLog = await swgohAPI.getPlayerUpdates(
                    guild.roster.map((m) => m.allyCode).filter((a): a is number => a != null),
                    PRIORITY.BACKGROUND,
                );
            } catch (err) {
                logger.error(`[patreonFuncs/guildsUpdate] rosterLen: ${guild?.roster?.length}\n${err}`);
                continue;
            }

            // If there were not changes found, move along, not the changes we were looking for
            if (!Object.keys(guildLog).length) continue;

            // Processs the guild changes
            const fields: { name: string; value: string }[] = [];
            for (const memberName of Object.keys(guildLog).sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))) {
                const member = guildLog[memberName];
                const fieldVal: string[] = [];
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
                await this.sendToChannel(gu.channel, { embeds: [{ fields: fieldChunk }] });
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
            if (!user) continue;

            // If the guild update isn't enabled, or is missing some needed info, move along
            const gt = user.guildTickets;
            if (!gt?.enabled) continue;
            if (!gt?.allyCode) continue;
            if (!gt?.channel) continue;

            const MAX_TICKETS = gt?.tickets || 600;
            const isMsgType = gt?.updateType === "msg";

            // If it's a user that only wants the message right before reset, don't bother getting all the info together at other times.
            const refresh = Number.parseInt(gt.nextChallengesRefresh ?? "", 10);
            if (isMsgType && refresh && !this.isWithinTime(refresh, nowTime, 1, 5) && refresh > nowTime) {
                continue;
            }

            // Check if the bot is able to send messages into the set channel
            const chanAvail = await this.isChannelAvailable(gt.channel);

            // If the channel is not available, move on
            if (!chanAvail) continue;

            // Get any updates for the guild
            let rawGuild: RawGuild | null = null;
            try {
                rawGuild = await swgohAPI.getRawGuild(gt.allyCode, undefined, { forceUpdate: true, priority: PRIORITY.BACKGROUND });
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

            if (!rawGuild?.roster?.length || !rawGuild?.profile) {
                logger.error(
                    `[patreonFuncs/guildsTickets] Could not get the guild/ roster for ${gt.allyCode}, guild output: ${JSON.stringify(rawGuild)}`,
                );
                continue;
            }

            let roster: RawGuild["roster"] = [];
            if (gt.sortBy === "tickets") {
                roster = rawGuild.roster.sort((a, b) =>
                    Number.parseInt(a.memberContribution[2]?.currentValue, 10) > Number.parseInt(b.memberContribution[2]?.currentValue, 10)
                        ? 1
                        : -1,
                );
            } else {
                roster = rawGuild.roster.sort((a, b) => (a.playerName.toLowerCase() > b.playerName.toLowerCase() ? 1 : -1));
            }

            let timeUntilReset = "";
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
            const outArr: string[] = [];
            for (const member of roster) {
                const tickets = Number.parseInt(member.memberContribution["2"]?.currentValue, 10) || 0;
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
                gt?.updateType === "msg" ? null : (gt.msgId ?? null),
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
        // True within the post-payout window (payoutCycleInfo.justAfterPayout). Firing across a
        // few ticks after payout instead of only at the exact minute self-heals a dropped tick;
        // shouldWriteHistory's 5-minute dedup keeps it to one entry per daily payout cycle.
        atPayout: boolean,
        // Tick timestamp - the dedup window and the entry's `ts` use the same clock the
        // payout math did, so a slow tick can't record an entry stamped after its own cycle
        now: number = Date.now(),
    ): ArenaHistEntry[] | undefined {
        // No rank means the account hasn't played this arena type - never write a null entry
        if (!atPayout || rank == null) return hist;
        return shouldWriteHistory(hist, now) ? updateArenaHistory(hist, rank, now) : hist;
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

    // Send a message (plain text or embed payload) to a channel by ID, across shards, but only
    // if the bot can see the channel and post in it. Centralizes the GUILD_TEXT + SendMessages/
    // ViewChannel (3072n) gate that every arena/guild alert used to inline-copy. Runs entirely
    // inside broadcastEval, so the closure only touches its context - no outer-scope refs (see
    // the "no logger/imports inside broadcastEval" rule).
    private async sendToChannel(channelId: string | null | undefined, content: string | { embeds: APIEmbed[] }): Promise<SendOutcome> {
        if (!channelId) return SEND_OUTCOME.UNDELIVERABLE;
        try {
            const results = await this.client.shard?.broadcastEval(
                async (client, { channelId, content }) => {
                    const channel = client.channels.cache.get(channelId);
                    if (
                        channel?.type === 0 && // 0 = GUILD_TEXT
                        // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                        channel.permissionsFor(client.user)?.has(3072n)
                    ) {
                        await channel.send(content);
                        return true;
                    }
                    return false;
                },
                { context: { channelId, content } },
            );
            // The channel lives on one shard; true means that shard actually delivered the message.
            // Every shard returning false means none of them has a channel we can post in, which is
            // a standing condition (deleted channel, kicked, ViewChannel revoked) rather than
            // something a later attempt fixes - so it is reported apart from a failed send.
            return results?.some((r) => r === true) ? SEND_OUTCOME.SENT : SEND_OUTCOME.UNDELIVERABLE;
        } catch (err) {
            // A permission/unknown-channel error raced past the pre-check above and is as standing
            // a condition as the pre-check's own failure. Anything unclassifiable stays FAILED.
            // Note discord.js's numeric `code` only reaches us if it survives the broadcastEval IPC
            // boundary; when it doesn't, this degrades to FAILED, i.e. today's retry behaviour.
            const outcome = classifySendError(err);
            logger.error(`[sendToChannel] Failed to send to ${channelId}: ${err instanceof Error ? err.message : String(err)}`);
            return outcome;
        }
    }

    // Send one DM, reporting whether it landed, transiently failed, or can never be delivered to
    // this recipient. Shared by the payout warn/result paths so both close out a cycle the same way.
    private async sendAlertDM(pUser: { send: (payload: { embeds: APIEmbed[] }) => Promise<unknown> }, embed: APIEmbed, what: string) {
        return pUser
            .send({ embeds: [embed] })
            .then(() => SEND_OUTCOME.SENT as SendOutcome)
            .catch((err: unknown) => {
                const outcome = classifySendError(err);
                const note = outcome === SEND_OUTCOME.UNDELIVERABLE ? " (undeliverable, closing out this cycle)" : "";
                logger.error(`[handleArenaAlerts] Failed to send ${what}${note}: ${err}`);
                return outcome;
            });
    }

    // Helper function to check if a channel is available and has proper permissions
    private async isChannelAvailable(channelId: string): Promise<boolean> {
        const channels = await this.client.shard?.broadcastEval(
            async (client, { chanId }) => {
                const channel = client.channels.cache.get(chanId);
                if (
                    channel?.type === 0 && // 0 = GUILD_TEXT
                    channel?.guild &&
                    // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                    channel.permissionsFor(client.user)?.has(3072n)
                ) {
                    return true;
                }
                return false;
            },
            { context: { chanId: channelId } },
        );
        return channels?.some((ch) => !!ch) ?? false;
    }

    // Format the output for the payouts embed
    private formatPayouts(players: ArenaWatchAcct[], arena: "char" | "fleet") {
        const times = new Map<string, { players: ArenaWatchAcct[] }>();
        const arenaString = `last${toProperCase(arena === "fleet" ? "ship" : arena)}` as "lastChar" | "lastShip";

        for (const player of players) {
            // A watched account may have no stored rank yet (fresh add, arena type not played)
            const rankString = (player[arenaString] ?? "N/A").toString().padStart(3);
            player.outString = expandSpaces(
                `**\`${constants.zws} ${rankString} ${constants.zws}\`** - ${player.mark ? `${player.mark} ` : ""}${player.name}`,
            );
            const timeKey = player.timeTil ?? "";
            const existingTime = times.get(timeKey);
            if (existingTime) {
                existingTime.players.push(player);
            } else {
                times.set(timeKey, {
                    players: [player],
                });
            }
        }
        const fieldOut: { name: string; value: string }[] = [];
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
        return players.sort((a, b) => ((a.duration ?? 0) > (b.duration ?? 0) ? 1 : -1));
    }

    // Compare ranks to see if we have both sides of the fight or not
    private checkRanks(inArr: ArenaRankChange[], aw: UserConfig["arenaWatch"]) {
        const checked: number[] = [];
        const outArr: string[] = [];
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
    private async sendBroadcastMsg(msgId: string | null, channelId: string, outEmbed: APIEmbed) {
        // Use broadcastEval to check all shards for the channel, and if there's a valid message
        // there, edit it. If not, send a fresh copy of it.
        if (!channelId) return;
        const messages = await this.client.shard?.broadcastEval(
            async (client, { msgIdIn, chanIn, outEmbed }) => {
                const channel = client.channels.cache.find((chan) => chan.id === chanIn || ("name" in chan && chan.name === chanIn));

                let msg: Message | null;
                let targetMsg: Message | null = null;
                if (
                    channel?.type === 0 && // 0 = GUILD_TEXT
                    channel?.guild &&
                    // 3072n = SendMessages (2048n) | ViewChannel (1024n)
                    channel.permissionsFor(client.user)?.has(3072n)
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
                            // NOTE: this runs inside broadcastEval (each shard's own context), so the
                            // module-level `logger` is not in scope here - referencing it throws
                            // "ReferenceError: logger is not defined". Swallow to null so a failed
                            // edit doesn't reject the whole broadcast; null is treated as "no message".
                            targetMsg = await msg.edit({ embeds: [outEmbed] }).catch(() => null);
                        } else {
                            // See note above: no `logger` inside broadcastEval; swallow to null.
                            targetMsg = await channel.send({ embeds: [outEmbed] }).catch(() => null);
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
        const msg = (messages ?? []).filter((a) => !!a);
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
        // null when the player data is missing poUTCOffsetMinutes - payout-based alerts are skipped
        timeLeft: number | null,
        // Rank/climb as they stood at the start of the tick - see RankSnapshot. Rank-drop DMs
        // compare against these frozen values so every user tracking the account fires.
        prev: { rank: number; climb: number },
        // Tick timestamp; combined with timeLeft to derive the payout cycle for once-per-cycle gating
        now: number = Date.now(),
    ): Promise<boolean> {
        const arenaConfig = {
            char: {
                alertType: "both" as const,
                altType: "char" as const,
                rankKey: "lastCharRank" as const,
                climbKey: "lastCharClimb" as const,
                warnMark: "charWarn" as const,
                resultMark: "charResult" as const,
                displayName: "character",
                capitalName: "Character",
            },
            ship: {
                alertType: "both" as const,
                altType: "fleet" as const,
                rankKey: "lastShipRank" as const,
                climbKey: "lastShipClimb" as const,
                warnMark: "fleetWarn" as const,
                resultMark: "fleetResult" as const,
                displayName: "ship",
                capitalName: "Fleet",
            },
        };

        const config = arenaConfig[arenaType];
        const arenaData = arenaType === "char" ? player.arena?.char : player.arena?.ship;

        // True when a per-cycle marker was written, so the caller knows to persist the user doc
        let userChanged = false;

        if (arenaData?.rank == null) return userChanged;

        if (
            user.arenaAlert &&
            user.arenaAlert.enableRankDMs !== "off" &&
            [config.alertType, config.altType].includes(user.arenaAlert.arena as "char" | "fleet" | "both")
        ) {
            const payoutTime =
                timeLeft === null ? null : `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;

            try {
                // Fetch inside the try so a transient users.fetch failure is contained here and the
                // rank/climb tracking below still runs, instead of rejecting out of the whole function.
                const pUser = await this.client.users.fetch(patron.discordID);
                if (pUser) {
                    // Payout cycle for this account this tick; null when the offset is missing, in
                    // which case the payout-timed alerts below are skipped entirely. The once-per-
                    // cycle markers live on the user's own arenaAlert (keyed by ally code), so a
                    // shared account can't let one user's warn minute suppress another's.
                    const cycle = timeLeft === null ? null : payoutCycleInfo(now, timeLeft);
                    const markKey = String(player.allyCode);
                    // Read-only view of this account's markers. The doc itself is only touched by
                    // markCycle below, once an alert has actually been delivered - reading through
                    // optional chaining keeps us from persisting an empty `{}` per watched account.
                    const marks = user.arenaAlert.alerted?.[markKey];
                    const markCycle = (field: "charWarn" | "fleetWarn" | "charResult" | "fleetResult", cycleId: number) => {
                        user.arenaAlert.alerted ??= {};
                        user.arenaAlert.alerted[markKey] ??= {};
                        user.arenaAlert.alerted[markKey][field] = cycleId;
                    };

                    // Payout warning: fire once per cycle on the first tick inside the window
                    // (payoutWarning minutes before payout, but not past it). Keying on the payout
                    // instant instead of an exact minute self-heals a dropped warning-minute tick.
                    if (
                        cycle &&
                        isInWarnWindow(cycle.minTil, user.arenaAlert.payoutWarning) &&
                        marks?.[config.warnMark] !== cycle.nextPayout
                    ) {
                        // Only mark the cycle once the DM is settled - a transiently failed send is
                        // retried on the next tick within the window (mirrors the channel path's
                        // defer-until-delivered handling), instead of being silently suppressed.
                        // UNDELIVERABLE closes the cycle too: this recipient cannot receive the DM
                        // at all, so retrying it on every remaining tick repeats a certain failure.
                        const outcome = await this.sendAlertDM(
                            pUser,
                            {
                                author: { name: "Arena Payout Alert" },
                                description: `${player.name}'s ${config.displayName} arena payout is in **${cycle.minTil}** minutes!${`\nYour current rank is ${arenaData.rank}`}`,
                                color: constants.colors.green,
                            },
                            "payout warning",
                        );
                        if (outcome !== SEND_OUTCOME.FAILED) {
                            markCycle(config.warnMark, cycle.nextPayout);
                            userChanged = true;
                        }
                    }

                    // Payout result: fire once per cycle shortly AFTER payout. The just-passed
                    // payout instant is the cycle id, so a dropped minTil===0 tick self-heals on
                    // the next tick within the result window.
                    if (
                        cycle &&
                        user.arenaAlert.enablePayoutResult &&
                        cycle.justAfterPayout &&
                        marks?.[config.resultMark] !== cycle.lastPayout
                    ) {
                        // Defer the marker until the DM settles so a transient failure retries next
                        // tick within the result window, matching the warn path above.
                        const outcome = await this.sendAlertDM(
                            pUser,
                            {
                                author: { name: `${config.capitalName} arena` },
                                description: `${player.name}'s payout ended at **${arenaData.rank}**!`,
                                color: constants.colors.green,
                            },
                            "payout result",
                        );
                        if (outcome !== SEND_OUTCOME.FAILED) {
                            markCycle(config.resultMark, cycle.lastPayout);
                            userChanged = true;
                        }
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
                                        // No payout footer when the payout time is unknown
                                        ...(payoutTime !== null ? { footer: { text: payoutTime } } : {}),
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[handleArenaAlerts] Failed to send rank drop alert: ${err}`));
                    }
                }
            } catch (e) {
                logger.error(`[handleArenaAlerts] Error processing ${config.displayName} arena alerts: ${e}`);
            }
        }

        // Update climb and rank tracking. Computed from the tick-start snapshot so a second
        // patron tracking the same account produces the identical (idempotent) result.
        acc[config.climbKey] = prev.climb ? (arenaData.rank < prev.rank ? arenaData.rank : prev.climb) : arenaData.rank;
        acc[config.rankKey] = arenaData.rank;

        return userChanged;
    }
}

// Create and export a singleton instance
const patreonFuncs = new PatreonFuncs();

/**
 * Fetches a player's data from the SWGOH API with patreon-aware cooldown.
 * Returns null on any error - the caller is responsible for the error reply.
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
    // Every command that fetches a player goes through here, so tiering it here is what gets
    // supporters served ahead of everyone else without touching all 47 command files.
    const priority = await patreonFuncs.commandPriority(interaction.user.id, interaction?.guild?.id);
    try {
        return await swgohAPI.player(allyCode, cooldown, priority);
    } catch (e) {
        logger.error(`[fetchPlayerWithCooldown] Error fetching player ${allyCode}: ${e}`);
        return null;
    }
}

export default patreonFuncs;
export { PatreonFuncs };
