import os from "node:os";
import { Worker } from "node:worker_threads";
import type ComlinkStub from "@swgoh-utils/comlink";
import { eachLimit } from "async";
import { env } from "../config/config.ts";
import { PRIORITY, type Priority } from "../data/constants/swapiServe.ts";
import statEnums from "../data/statEnum.ts";
import cache from "../modules/cache.ts";
import { convertMS, readJSON } from "../modules/functions.ts";
import type { PlayerDatacron } from "../types/datacron_types.ts";
import type {
    ComlinkAbility,
    ComlinkDatacron,
    ComlinkMod,
    ComlinkPlayer,
    RawCharacter,
    RawGuild,
    RawGuildMember,
    SWAPIGear,
    SWAPIGuild,
    SWAPIGuildAlteredMemberContribution,
    SWAPIGuildMember,
    SWAPILang,
    SWAPIMod,
    SWAPIPlayer,
    SWAPIPlayerArena,
    SWAPIPlayerArenaProfile,
    SWAPIPlayerArenaProfilePVP,
    SWAPIRecipe,
    SWAPIUnit,
    SWAPIUnitAbility,
    SWAPIWorkerGuildLog,
    SWAPIWorkerOutput,
} from "../types/swapi_types.ts";
import type { PlayerArenaRes, PlayerCooldown, RefreshCount } from "../types/types.ts";
import logger from "./Logger.ts";
import { withStub } from "./swapiQueue.ts";

// Shape of the raw comlink getGuild response as consumed by formatGuild.
// The API returns far more; only the fields actually read are typed, the rest ride the index signatures.
interface ComlinkGuildResponse {
    guild: {
        profile: {
            id: string;
            name: string;
            externalMessageKey: string;
            memberCount: number;
            enrollmentStatus: number;
            levelRequirement: number;
            bannerColorId: string;
            bannerLogoId: string;
            internalMessage: string;
            guildGalacticPower: string | number;
            [key: string]: unknown;
        };
        recentRaidResult?: { identifier: { campaignMissionId: string }; guildRewardScore: number; raidId: string }[];
        member: { playerId: string; memberLevel: number; memberContribution: number; [key: string]: unknown }[];
        [key: string]: unknown;
    };
    raidLaunchConfig: unknown;
    [key: string]: unknown;
}

const THREAD_COUNT = os.cpus().length;
const abilityCosts = await readJSON<Record<string, Record<string, number>>>(`${import.meta.dirname}/../data/abilityCosts.json`);

// if (!config.backingServices.swapiClient || !config.credentials.swapi) {
//     throw new Error("Missing SWAPI client config or credentials!");
// }

// Minimal shapes for the JSON lookup maps -- only the fields the bot reads are typed; the index
// signature keeps the rest of each entry's data accessible without enumerating it.
interface UnitMapEntry {
    nameKey: string;
    crew: SWAPIUnit["crew"];
    combatType: SWAPIUnit["combatType"];
    [key: string]: unknown;
}
interface SkillMapEntry {
    tiers: number;
    [key: string]: unknown;
}
interface ModMapEntry {
    slot: number;
    set: string | number;
    pips: number;
    [key: string]: unknown;
}

let modMap = await readJSON<Record<string, ModMapEntry>>(`${import.meta.dirname}/../data/modMap.json`);
let unitMap = await readJSON<Record<string, UnitMapEntry>>(`${import.meta.dirname}/../data/unitMap.json`);
let skillMap = await readJSON<Record<string, SkillMapEntry>>(`${import.meta.dirname}/../data/skillMap.json`);

const swapiDataDir = `${import.meta.dirname}/../data`;

export const SWAPI_DATA_FILES: string[] = [`${swapiDataDir}/modMap.json`, `${swapiDataDir}/unitMap.json`, `${swapiDataDir}/skillMap.json`];

/**
 * Re-read the three API map files. Previously driven by this module's own 6 minute interval; now
 * called by modules/dataRefresh.ts so there is a single refresh cadence.
 *
 * `dir` is injectable for tests only.
 */
export async function refreshMapFiles(dir: string = swapiDataDir): Promise<RefreshCount[]> {
    const [modMapData, unitMapData, skillMapData] = await Promise.all([
        readJSON<Record<string, ModMapEntry>>(`${dir}/modMap.json`),
        readJSON<Record<string, UnitMapEntry>>(`${dir}/unitMap.json`),
        readJSON<Record<string, SkillMapEntry>>(`${dir}/skillMap.json`),
    ]);

    // --- apply phase: synchronous, no await below this line ---
    modMap = modMapData;
    unitMap = unitMapData;
    skillMap = skillMapData;

    return [
        { label: "modMap", total: Object.keys(modMap).length, noun: "keys" },
        { label: "unitMap", total: Object.keys(unitMap).length, noun: "keys" },
        { label: "skillMap", total: Object.keys(skillMap).length, noun: "keys" },
    ];
}

// const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Critical Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Critical Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Critical Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };

// Exported for reuse by modules/datacrons.ts, which de-scales datacron affix values with the same
// rule (flat stats scaled by 1e8, everything else 1e6).
export const flatStats = [
    1, // health
    5, // speed
    28, // prot
    41, // offense
    42, // defense
];

// The real concurrency limit now lives in swapiServe, which owns one global budget across every
// shard and both updater services. This cap only bounds how many sockets and pending promises a
// single batch parks while waiting its turn, so it is deliberately far above anything that would
// bind in practice.
const MAX_BATCH_IN_FLIGHT = 250;

/**
 * Pulls the HTTP status off a thrown comlink/got error, or undefined when the failure carried
 * no response at all (transport errors: ECONNREFUSED, socket timeouts).
 *
 * This is the only status signal that survives the round trip. @swgoh-utils/comlink's
 * _modifyErrorResponse overwrites error.message with the upstream body's own message before
 * rethrowing, so got's "Response code NNN (...)" wording is gone for every error comlink
 * describes - but it leaves error.response untouched.
 */
export function getFetchErrorStatus(err: unknown): number | undefined {
    if (typeof err !== "object" || err === null || !("response" in err)) return undefined;
    const { response } = err;
    if (typeof response !== "object" || response === null || !("statusCode" in response)) return undefined;
    const { statusCode } = response;
    return typeof statusCode === "number" ? statusCode : undefined;
}

// Prefixes the status onto a give-up message so a rejected request can be told apart from an
// upstream 5xx after the fact. comlink's rewritten message names neither - "IllegalStateException:
// Connection pool shut down" reads identically whether it arrived as a 500 or a 400.
function describeFetchFailure(message: string, statusCode?: number): string {
    return statusCode ? `[${statusCode}] ${message}` : message;
}

/**
 * Runs a queued comlink call, returning null instead of throwing when it fails.
 *
 * Retry, the retry budget, and the retryable-vs-not classification all moved into swapiServe,
 * which sees every call and can pace retries against the same budget as new work. What stays here
 * is only how a BATCH treats a member that ultimately failed: drop it and carry on, exactly as
 * fetchWithRetry's null return did, rather than losing the whole batch to one bad ally code.
 */
async function tryCall<T>(
    priority: Priority,
    throttleKey: string,
    describe: (detail: string) => string,
    fn: (stub: ComlinkStub) => Promise<T>,
): Promise<T | null> {
    try {
        return await withStub(priority, fn);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.throttleError(throttleKey, describe(describeFetchFailure(message, getFetchErrorStatus(err))));
        return null;
    }
}

/**
 * Maps one comlink arena profile onto the shape the arena tick consumes.
 *
 * Returns null rather than throwing on a payload without a pvpProfile array. getPlayersArena maps
 * a whole batch, and the arena tick passes every watched ally code in one call, so a throw here
 * would discard every player in that batch: a lost minute of rank tracking for all of them, and a
 * lost payout record for anyone whose payout cycle fell on that minute.
 */
export function mapArenaProfile(profile: SWAPIPlayerArenaProfile | null): PlayerArenaRes | null {
    if (!profile || !Array.isArray(profile.pvpProfile)) return null;

    const charArena = profile.pvpProfile.find((t: SWAPIPlayerArenaProfilePVP) => t.tab === 1);
    const shipArena = profile.pvpProfile.find((t: SWAPIPlayerArenaProfilePVP) => t.tab === 2);
    return {
        name: profile.name,
        allyCode: Number.parseInt(profile.allyCode, 10),
        arena: {
            char: {
                rank: charArena ? charArena.rank : null,
            },
            ship: {
                rank: shipArena ? shipArena.rank : null,
            },
        },
        poUTCOffsetMinutes: profile.localTimeZoneOffsetMinutes,
    };
}

/**
 * Maps comlink's datacron payload onto our player shape.
 *
 * Normalizes two quirks of the raw payload: statValue arrives as a STRING of scaled integers,
 * and stat-only affixes send targetRule/abilityId as "" rather than omitting them. Reroll fields
 * are retained deliberately -- the follow-on analysis work (Spec B) needs them.
 */
export function mapPlayerDatacrons(datacrons: ComlinkDatacron[] | undefined): PlayerDatacron[] {
    if (!datacrons?.length) return [];
    return datacrons.map((datacron) => ({
        id: datacron.id ?? "",
        setId: datacron.setId ?? 0,
        templateId: datacron.templateId ?? "",
        tag: datacron.tag ?? [],
        locked: datacron.locked ?? false,
        focused: datacron.focused ?? false,
        rerollIndex: datacron.rerollIndex,
        rerollCount: datacron.rerollCount,
        affix: (datacron.affix ?? []).map((a) => ({
            // The game sends "" for stat-only affixes; normalize to undefined so callers
            // only need a single absent-check.
            targetRule: a.targetRule || undefined,
            abilityId: a.abilityId || undefined,
            statType: a.statType,
            // statValue arrives as a STRING of scaled integers (e.g. "26807422").
            statValue: a.statValue == null ? undefined : Number(a.statValue),
            requiredUnitTier: a.requiredUnitTier,
            requiredRelicTier: a.requiredRelicTier,
        })),
    }));
}

/**
 * Reduce a mod to only the fields the bot stores and consumes (see SWAPIMod).
 * The statcalc service returns mods carrying raw game-economy fields
 * (sellValue, removeCost, levelCost, xp, locked, bonusQuantity, convertedItem,
 * rerolledCount) that nothing reads; persisting them verbatim accounted for
 * ~31% of every playerStats document. Picking the whitelisted keys drops them.
 */
export function pruneModFields(mod: SWAPIMod): SWAPIMod {
    return {
        id: mod.id,
        level: mod.level,
        tier: mod.tier,
        slot: mod.slot,
        set: mod.set,
        pips: mod.pips,
        primaryStat: mod.primaryStat,
        secondaryStat: mod.secondaryStat,
    };
}

// Ceiling for a single getPlayerUpdates worker. Chunk processing is CPU-bound and finishes in
// seconds; this only exists to kill a stalled worker before it pins its heap for the process lifetime.
const WORKER_TIMEOUT_MS = 60_000;

class SWAPI {
    private specialAbilityList: SWAPIUnitAbility[] | null = null;

    // Set the max cooldowns (In minutes)
    private readonly playerMinCooldown = 1; // 1 min
    private readonly playerMaxCooldown = 3 * 60; // 3 hours
    private readonly guildMinCooldown = 1; // 1 min
    private readonly guildMaxCooldown = 6 * 60; // 6 hours

    // Grab the abilities that have Zeta / Omicron levels for future reference
    private async getSpecialAbilities(): Promise<SWAPIUnitAbility[]> {
        if (!this.specialAbilityList) {
            const abilityList = await cache.get(
                env.MONGODB_SWAPI_DB,
                "abilities",
                {
                    $or: [
                        {
                            isOmicron: true,
                            language: "eng_us",
                        },
                        {
                            isZeta: true,
                            language: "eng_us",
                        },
                    ],
                },
                {
                    skillId: 1,
                    _id: 0,
                    zetaTier: 1,
                    omicronTier: 1,
                    omicronMode: 1,
                },
            );
            this.specialAbilityList = abilityList as SWAPIUnitAbility[];
        }
        return this.specialAbilityList;
    }

    async playerByName(name: string, limit = 0) {
        try {
            if (!name?.length || typeof name !== "string") return null;

            /** Try to get player's ally code from cache */
            const player = await cache.get(
                env.MONGODB_SWAPI_DB,
                "playerStats",
                { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
                { name: 1, allyCode: 1, _id: 0 },
                limit,
            );

            return player;
        } catch (e) {
            logger.error(`SWAPI Broke getting player by name (${name}): ${e}`);
            throw e;
        }
    }

    async getPlayersArena(allyCodes: number | number[], priority: Priority = PRIORITY.PUBLIC_COMMAND) {
        let acArr = Array.isArray(allyCodes) ? allyCodes : [allyCodes];
        acArr = acArr.filter((ac) => !!ac && ac.toString().length === 9);
        if (!acArr.length) throw new Error("No valid ally code(s) entered");

        const playersOut: SWAPIPlayerArenaProfile[] = [];
        await eachLimit(acArr, MAX_BATCH_IN_FLIGHT, async (ac) => {
            const p = await tryCall<SWAPIPlayerArenaProfile>(
                priority,
                "swapi-arena-profile",
                (detail) => `Error fetching arena profile for ${ac}: ${detail}`,
                (stub) => stub.getPlayerArenaProfile(ac.toString()) as Promise<SWAPIPlayerArenaProfile>,
            );
            if (p) {
                playersOut.push(p);
            }
        });

        return playersOut.map(mapArenaProfile).filter((p): p is PlayerArenaRes => p !== null);
    }

    async getPlayerUpdates(allyCodes: number | number[], priority: Priority = PRIORITY.PUBLIC_COMMAND) {
        const specialAbilities = await this.getSpecialAbilities();
        const acArr = Array.isArray(allyCodes) ? allyCodes : [allyCodes];

        const updatedBare: SWAPIPlayer[] = [];
        await eachLimit(acArr, MAX_BATCH_IN_FLIGHT, async (ac) => {
            const tempBare = await tryCall<ComlinkPlayer>(
                priority,
                "swapi-getPlayer",
                (detail) => `Error in eachLimit getPlayer (${ac}): ${detail}`,
                (stub) => stub.getPlayer(ac?.toString()) as Promise<ComlinkPlayer>,
            );
            if (tempBare) {
                const formattedComlinkPlayer = await this.formatComlinkPlayer(tempBare);
                updatedBare.push(formattedComlinkPlayer);
            }
        });
        const oldMembers = await cache.get(env.MONGODB_SWAPI_DB, "rawPlayers", {
            allyCode: { $in: acArr },
        });
        const processMemberChunk = async (updatedBare: SWAPIPlayer[], chunkIx: number) => {
            const worker = new Worker(`${import.meta.dirname}/workers/getPlayerUpdates.ts`, {
                workerData: { oldMembers, updatedBare, specialAbilities, chunkIx },
            });
            try {
                const chunkRes: SWAPIWorkerOutput = await new Promise((resolve, reject) => {
                    let settled = false;
                    // Guard against a stalled worker pinning its heap for the life of the shard: if it
                    // never posts a result we reject (and terminate in finally) instead of waiting forever.
                    const timer = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        logger.error(`[SWAPI getPlayerUpdates] Worker timed out after ${WORKER_TIMEOUT_MS}ms`);
                        reject(new Error(`Worker timed out after ${WORKER_TIMEOUT_MS}ms`));
                    }, WORKER_TIMEOUT_MS);
                    worker.on("message", (result) => {
                        settled = true;
                        clearTimeout(timer);
                        resolve(result);
                    });
                    worker.on("error", (err) => {
                        settled = true;
                        clearTimeout(timer);
                        reject(err);
                    });
                    worker.on("exit", (code) => {
                        clearTimeout(timer);
                        if (code !== 0 && !settled) {
                            settled = true;
                            logger.error(`[SWAPI getPlayerUpdates] Worker stopped with exit code ${code}`);
                            reject(new Error(`Worker stopped with exit code ${code}`));
                        }
                    });
                });
                return chunkRes;
            } finally {
                // Always release the thread/isolate -- on success the worker may otherwise linger until
                // its own event loop drains, and on timeout it would never exit on its own.
                await worker.terminate();
            }
        };

        const memberChunks: SWAPIPlayer[][] = [];
        const chunkSize = Math.ceil(updatedBare.length / THREAD_COUNT);
        for (let ix = 0, len = updatedBare.length; ix < len; ix += chunkSize) {
            const chunk = updatedBare.slice(ix, ix + chunkSize);
            memberChunks.push(chunk);
        }
        const guildLog: SWAPIWorkerGuildLog = {};
        // Using Promise.all here is acceptable because workers offload CPU-intensive stat
        // calculations to separate threads, preventing main thread blocking. The coordination
        // itself is lightweight and allows parallel worker execution.
        await Promise.all(
            memberChunks.map(async (mChunk, ix) => {
                const chunkRes: SWAPIWorkerOutput = await processMemberChunk(mChunk, ix + 1);
                return chunkRes;
            }),
        )
            .then(async (res) => {
                const skillsArr: string[] = [];
                const defIdArr: string[] = [];
                for (const { guildLogOut, cacheUpdatesOut, skills, defIds } of res) {
                    for (const [key, value] of Object.entries(guildLogOut)) {
                        guildLog[key] = value;
                    }
                    skillsArr.push(...skills);
                    defIdArr.push(...defIds);
                    if (!cacheUpdatesOut.length) continue;
                    await cache.putMany(env.MONGODB_SWAPI_DB, "rawPlayers", cacheUpdatesOut);
                }
                const [skillNames, unitNames] = await Promise.all([
                    cache.get(
                        env.MONGODB_SWAPI_DB,
                        "abilities",
                        { skillId: { $in: skillsArr }, language: "eng_us" },
                        { nameKey: 1, skillId: 1 },
                    ),
                    cache.get(env.MONGODB_SWAPI_DB, "units", { baseId: { $in: defIdArr }, language: "eng_us" }, { baseId: 1, nameKey: 1 }),
                ]);
                const langKeys: Record<string, string> = {};
                for (const nameId of [...skillNames, ...unitNames]) {
                    langKeys[nameId?.skillId || nameId?.baseId] = nameId.nameKey;
                }

                for (const [userName, changeObj] of Object.entries(guildLog)) {
                    // Run through all the skill/ unit names and replace the IDs with normal names
                    for (const [changeType, strArr] of Object.entries(changeObj)) {
                        // Update the strings with namekeys for anything inside `{}` braces
                        const updatedArr = strArr.map((str: string) =>
                            str.replace(/\{([^}]*)\}/g, (_, p1) => {
                                return langKeys[p1] || p1;
                            }),
                        );
                        guildLog[userName][changeType] = updatedArr;
                    }
                }
            })
            .catch((err) => {
                logger.error(`Error running workers: ${err}`);
                throw err;
            });

        return guildLog;
    }

    async unitStats(
        allyCodes: number | number[],
        cooldown: PlayerCooldown = {
            player: this.playerMaxCooldown,
            guild: this.guildMaxCooldown,
        },
        options: { force?: boolean; defId?: string; priority?: Priority } = { force: false },
    ): Promise<SWAPIPlayer[]> {
        const priority = options.priority ?? PRIORITY.PUBLIC_COMMAND;
        // Make sure the allyCode(s) are in an array
        if (!allyCodes) return [];
        const acArr: number[] = Array.isArray(allyCodes) ? allyCodes : [allyCodes];

        const specialAbilities: SWAPIUnitAbility[] = await this.getSpecialAbilities();

        let playerStats: SWAPIPlayer[] = [];
        try {
            if (!acArr?.length) {
                throw new Error("No valid ally code(s) entered");
            }
            const filtereredAcArr = acArr.filter((a) => a?.toString().length === 9);

            let players: SWAPIPlayer[] = [];
            if (!options.force) {
                // If it's going to pull everyone fresh anyways, why bother grabbing the old data?
                if (options?.defId?.length) {
                    players = await cache.getAggregate(env.MONGODB_SWAPI_DB, "playerStats", [
                        { $match: { allyCode: { $in: filtereredAcArr } } },
                        {
                            $project: {
                                _id: 0,
                                name: 1,
                                allyCode: 1,
                                updated: 1,
                                roster: {
                                    $filter: {
                                        input: "$roster",
                                        as: "r",
                                        cond: { $eq: ["$$r.defId", options.defId] },
                                    },
                                },
                            },
                        },
                    ]);
                } else {
                    players = await cache.get(env.MONGODB_SWAPI_DB, "playerStats", { allyCode: { $in: filtereredAcArr } });
                }
            }

            // If options.force is true, set the list of unexpired players to be empty so that all players will be run through the updater
            const updatedList = players.filter((p) => !this.isExpired(p.updated, cooldown, players.length > 5));
            const updatedAC = new Set(updatedList.map((p) => p.allyCode));
            const needUpdating = acArr.filter((a) => !updatedAC.has(a));

            playerStats = playerStats.concat(updatedList);

            if (needUpdating.length) {
                let updatedBare: SWAPIPlayer[] = [];
                try {
                    await eachLimit(needUpdating, MAX_BATCH_IN_FLIGHT, async (ac) => {
                        const tempBare = await tryCall<ComlinkPlayer>(
                            priority,
                            "swapi-getPlayer",
                            (detail) => `[swapi getPlayer] Failed to fetch player ${ac}: ${detail}`,
                            (stub) => stub.getPlayer(ac?.toString()) as Promise<ComlinkPlayer>,
                        );
                        if (tempBare) {
                            const formattedComlinkPlayer = await this.formatComlinkPlayer(tempBare);
                            updatedBare.push(formattedComlinkPlayer);
                        }
                    });

                    // Check if any players are missing rosters, and re-run them through to try and get full player objects
                    const missingRosters = updatedBare.filter((p) => !p?.roster?.length);
                    if (missingRosters.length) {
                        updatedBare = updatedBare.filter((p) => p?.roster?.length);
                        for (const missing of missingRosters) {
                            const tempBare = await tryCall<ComlinkPlayer>(
                                priority,
                                "swapi-getPlayer-missing-roster",
                                (detail) =>
                                    `[swapi getPlayer retry] Failed to fetch player ${missing?.allyCode} with missing roster: ${detail}`,
                                (stub) => stub.getPlayer(missing?.allyCode?.toString()) as Promise<ComlinkPlayer>,
                            );
                            if (tempBare) {
                                const formattedComlinkPlayer = await this.formatComlinkPlayer(tempBare);
                                updatedBare.push(formattedComlinkPlayer);
                            }
                        }
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    logger.error(`[swapi unitStats] Failed to fetch player updates: ${message}`);
                    logger.log(`[swapi unitStats] Returning cached data for ${players?.length || 0} players`);
                    return players;
                }

                const bulkWrites: SWAPIWorkerOutput["cacheUpdatesOut"] = [];
                for (const bareP of updatedBare) {
                    if (bareP?.roster?.length) {
                        try {
                            const statRoster = await fetch(`${env.SWAPI_STATCALC_URL}/api?flags=gameStyle,calcGP`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(bareP.roster),
                            });

                            if (!statRoster.ok) {
                                continue;
                            }

                            const statRosterRes = await statRoster.json();
                            bareP.roster = statRosterRes;
                        } catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            logger.error(`[swapi unitStats] Stats calculation failed for player ${bareP.allyCode}: ${message}`);
                            continue;
                        }

                        for (const char of bareP.roster) {
                            if (char.mods?.length) {
                                char.mods = char.mods.map(pruneModFields);
                            }
                            for (const ability of char.skills) {
                                const thisAbility = specialAbilities.find((abi) => abi.skillId === ability.id);
                                if (thisAbility) {
                                    if (thisAbility.omicronTier) {
                                        ability.isOmicron = true;
                                        ability.omicronTier = thisAbility.omicronTier + 1;
                                        ability.omicronMode = thisAbility.omicronMode;
                                    }
                                    if (thisAbility.zetaTier) {
                                        ability.isZeta = true;
                                        ability.zetaTier = thisAbility.zetaTier + 1;
                                    }
                                }
                            }
                        }

                        if (!bareP.updated) bareP.updated = Date.now();
                        if (!bareP.updatedAt) bareP.updatedAt = new Date();
                        bulkWrites.push({
                            updateOne: {
                                filter: { allyCode: bareP.allyCode },
                                update: { $set: bareP },
                                upsert: true,
                            },
                        });
                        if (options?.defId?.length) {
                            // bareP.roster = bareP.roster.filter((ch) => ch.defId === options.defId);
                            playerStats.push({
                                ...bareP,
                                roster: bareP.roster.filter((ch: SWAPIUnit) => ch.defId === options.defId),
                            });
                        } else {
                            playerStats.push(bareP);
                        }
                    }
                }
                if (bulkWrites.length) {
                    await cache.putMany(env.MONGODB_SWAPI_DB, "playerStats", bulkWrites);
                }
            }

            // Sort results to match the order of input allyCodes
            // This ensures consistent ordering for comparison commands (e.g., grandarena, versus)
            // Note: acArr may contain strings at runtime despite number[] type, so normalize to numbers for comparison
            const sortedStats = acArr
                .map((allyCode) => {
                    // Normalize to number for comparison (handles both string and number inputs)
                    const normalizedAC = typeof allyCode === "string" ? Number.parseInt(allyCode, 10) : allyCode;
                    return playerStats.find((p) => p?.allyCode === normalizedAC);
                })
                .filter((p) => p !== undefined);

            return sortedStats;
        } catch (error) {
            logger.error(`SWAPI Broke getting playerStats: ${error}`);
            throw error;
        }
    }

    async player(
        allyCode: string | number,
        cooldown?: PlayerCooldown,
        priority: Priority = PRIORITY.PUBLIC_COMMAND,
    ): Promise<SWAPIPlayer | null> {
        const res = await this.unitStats(Number.parseInt(String(allyCode), 10), cooldown, { force: false, priority });
        return res?.[0] ?? null;
    }

    private async formatComlinkPlayer(comlinkPlayer: ComlinkPlayer): Promise<SWAPIPlayer> {
        const comlinkPlayerArena: Record<number, SWAPIPlayerArena["char"]> = {};
        const emptyArena = { rank: null, squad: null };

        for (const { tab, rank, squad } of comlinkPlayer.pvpProfile ?? []) {
            comlinkPlayerArena[tab] = {
                rank: rank,
                squad:
                    squad?.cell?.map((unit) => {
                        return {
                            id: unit.unitId,
                            defId: typeof unit.unitDefId === "string" ? unit.unitDefId.split(":")[0] : unit.unitDefId,
                        };
                    }) || [],
                // TODO Should probably look into making use of this if I ever get around to figuring out datacrons
                // unformattedSquad: squad
            };
        }

        return {
            allyCode: Number.parseInt(comlinkPlayer.allyCode, 10),
            guildId: comlinkPlayer.guildId,
            guildName: comlinkPlayer.guildName,
            id: comlinkPlayer.playerId,
            name: comlinkPlayer.name,
            level: comlinkPlayer.level,
            roster: comlinkPlayer.rosterUnit
                .map((unit) => {
                    const thisDefId = unit.definitionId.split(":")[0];
                    const thisUnit = unitMap[thisDefId];
                    if (!thisUnit?.nameKey) return null;
                    return {
                        id: unit.id,
                        defId: thisDefId,
                        nameKey: thisUnit?.nameKey,
                        level: unit.currentLevel,
                        rarity: unit.currentRarity,
                        gear: unit.currentTier,
                        equipped: unit.equipment ? unit.equipment : [],
                        skills: unit.skill
                            .map((sk) => {
                                const thisSkill = skillMap[sk.id];
                                if (!thisSkill) return null;
                                return {
                                    id: sk.id,
                                    tier: sk.tier + 2,
                                    tiers: thisSkill?.tiers ? thisSkill.tiers + 1 : 0,
                                };
                            })
                            .filter((sk) => !!sk),
                        relic: unit.relic,
                        purchasedAbilityId: unit.purchasedAbilityId,
                        crew: thisUnit?.crew,
                        combatType: thisUnit.combatType,
                        mods: unit.equippedStatMod ? unit.equippedStatMod.map((mod) => this.formatMod(mod)) : [],
                    };
                })
                .filter((unit) => !!unit),
            stats:
                comlinkPlayer.profileStat
                    ?.filter(({ nameKey }) => {
                        return nameKey?.includes("GALACTIC_POWER");
                    })
                    .map(({ nameKey, value }) => {
                        return {
                            nameKey,
                            value: Number(value),
                        };
                    }) || [],
            arena: {
                char: comlinkPlayerArena[1] || emptyArena,
                ship: comlinkPlayerArena[2] || emptyArena,
            },
            guildBannerColor: comlinkPlayer.guildBannerColor,
            guildBannerLogo: comlinkPlayer.guildBannerLogo,
            poUTCOffsetMinutes: comlinkPlayer.localTimeZoneOffsetMinutes,
            lastActivity: comlinkPlayer.lastActivityTime,
            datacron: mapPlayerDatacrons(comlinkPlayer.datacron),

            // // TODO I don't do anything with these, but I probably should at some point
            // grandArena: comlinkPlayer.seasonStatus,
            // playerRating: comlinkPlayer.playerRating,
            // lifetimeSeasonScore: comlinkPlayer.lifetimeSeasonScore,

            // // I don't do anything with the rest of these at this time
            // titles: {
            //     selected: comlinkPlayer.selectedPlayerTitle || null,
            //     unlocked: comlinkPlayer.unlockedPlayerTitle || []
            // }
            // portraits: {
            //     selected: comlinkPlayer.selectedPlayerPortrait?.id || null,
            //     unlocked: comlinkPlayer?.unlockedPlayerPortrait.map(portrait => portrait.id) || []
            // },
            // guildTypeId: comlinkPlayer.guildTypeId,

            // // Never seems to be populated?
            // guildLogoBackground,
        };
    }

    private formatMod({ definitionId, primaryStat, id, level, tier, secondaryStat, ...rest }: ComlinkMod) {
        const modSchema = modMap[definitionId] ?? ({} as ModMapEntry);
        const primaryStatId = primaryStat.stat.unitStatId;
        const primaryStatScaler = flatStats.includes(primaryStatId) ? 1e8 : 1e6;
        return {
            ...rest,
            id,
            level,
            tier,
            slot: modSchema.slot - 1, // mod slots are numbered 2-7
            set: Number(modSchema.set),
            pips: modSchema.pips,
            primaryStat: {
                unitStat: primaryStat.stat.unitStatId,
                value: Number.parseInt(primaryStat.stat.unscaledDecimalValue, 10) / primaryStatScaler,
            },
            secondaryStat: secondaryStat
                ? secondaryStat.map((stat) => {
                      const statId = stat.stat.unitStatId;
                      const statScaler = flatStats.includes(statId) ? 1e8 : 1e6;
                      return {
                          unitStat: statId,
                          value: Number.parseInt(stat.stat.unscaledDecimalValue, 10) / statScaler,
                          roll: stat.statRolls,
                      };
                  })
                : [],
        };
    }

    async langChar(char: Partial<SWAPIUnit>, lang: SWAPILang) {
        const thisLang = lang ? lang.toLowerCase() : "eng_us";
        if (!char) throw new Error("Missing Character");

        if (char.defId) {
            const unit = await this.units(char.defId);
            char.nameKey = unit?.nameKey;
        }

        if (char.mods) {
            for (const mod of char.mods) {
                // If they've got the numbers instead of enums, enum em
                // if (mod.primaryStat.unitStatId) mod.primaryStat.unitStat = mod.primaryStat.unitStatId;
                const primaryUnitStatId = mod.primaryStat.unitStatId || mod.primaryStat.unitStat;
                if (primaryUnitStatId != null && !Number.isNaN(primaryUnitStatId)) {
                    mod.primaryStat.unitStat = statEnums.enums[primaryUnitStatId as number];
                }
                for (const stat of mod.secondaryStat) {
                    const unitStatId = stat.unitStatId || stat.unitStat;
                    if (unitStatId != null && !Number.isNaN(unitStatId)) {
                        stat.unitStat = statEnums.enums[unitStatId as number];
                    }
                }
            }
        }

        if (char.factions) {
            for (const [factionIx, thisFaction] of char.factions.entries()) {
                const factionNameRes: { nameKey: string }[] = await cache.get(
                    env.MONGODB_SWAPI_DB,
                    "categories",
                    { id: thisFaction, language: thisLang },
                    { nameKey: 1, _id: 0 },
                );
                const factionName = factionNameRes?.[0];
                if (!factionName) throw new Error(`Cannot find factionName for ${thisFaction}`);
                char.factions[factionIx] = (factionName as unknown as { nameKey: string }).nameKey;
            }
        }

        // In case it has skillReferenceList (Shouldn't happen that I can tell)
        // if (char.skillReferenceList) {
        //     for (const skill in char.skillReferenceList) {
        //         let skillName = await cache.get(
        //             config.mongodb.swapidb,
        //             "abilities",
        //             { skillId: char.skillReferenceList[skill].skillId, language: thisLang },
        //             { nameKey: 1, _id: 0 },
        //         );
        //         if (Array.isArray(skillName)) skillName = skillName[0];
        //         if (!skillName) {
        //             logger.error(`[swapi langChar] Cannot find skillName for ${char.skillReferenceList[skill].skillId}`);
        //             char.skillReferenceList[skill].nameKey = "N/A";
        //             continue;
        //         }
        //         char.skillReferenceList[skill].nameKey = skillName.nameKey;
        //     }
        // }

        // In case it doesn't
        if (char.skills) {
            for (const skill of char.skills) {
                const skillNameRes: { nameKey: string }[] = await cache.get(
                    env.MONGODB_SWAPI_DB,
                    "abilities",
                    { skillId: skill.id, language: thisLang },
                    { nameKey: 1, _id: 0 },
                );
                const skillName = skillNameRes?.[0];
                if (!skillName) {
                    logger.error(`[swapi langChar] Cannot find skillName for ${skill.id}`);
                    skill.nameKey = "N/A";
                    continue;
                }
                skill.nameKey = (skillName as unknown as { nameKey: string }).nameKey;
            }
        }
        return char;
    }

    async guildUnitStats(allyCodes: number[], defId: string, cooldown: PlayerCooldown) {
        if (!cooldown?.guild || cooldown.guild > this.guildMaxCooldown) cooldown.guild = this.guildMaxCooldown;
        if (cooldown.guild < this.guildMinCooldown) cooldown.guild = this.guildMinCooldown;
        if (!defId) throw new Error("[swapi guildUnitStats] You need to specify a defId");

        const outStats: SWAPIUnit[] = [];
        const blankUnit = {
            defId: defId,
            gear: 0,
            gp: 0,
            level: 0,
            rarity: 0,
            skills: [],
            zetas: [],
            omicrons: [],
            relic: { currentTier: 0 },
            equipped: [],
            stats: {},
        };
        const players: SWAPIPlayer[] = await this.unitStats(allyCodes, cooldown, { defId: defId });
        if (!players.length) throw new Error("Couldn't get your stats");

        for (const player of players) {
            let unit: SWAPIUnit | null = null;

            if (player?.roster?.length) {
                unit = player.roster.find((c) => c.defId === defId) ?? null;
            }
            if (!unit) {
                unit = JSON.parse(JSON.stringify(blankUnit)) as SWAPIUnit;
            }
            unit.zetas = unit.skills.filter((s) => s.isZeta && s.zetaTier != null && s.tier >= s.zetaTier);
            unit.omicrons = unit.skills.filter((s) => s.isOmicron && s.omicronTier != null && s.tier >= s.omicronTier);
            unit.player = player.name;
            unit.allyCode = player.allyCode;
            unit.updated = player.updated;
            outStats.push(unit);
        }
        return outStats;
    }

    async abilities(skillArray: string | string[], lang: SWAPILang = "eng_us", opts = { min: false }) {
        if (!skillArray) {
            throw new Error("You need to have a list of abilities here");
        }
        const skillArr = Array.isArray(skillArray) ? skillArray : [skillArray];
        // Guard against a falsy lang (default params only cover `undefined`, not `null`),
        // matching the rest of the lang-aware methods (gear/units/unitNames/getCharacter).
        const thisLang = lang?.toLowerCase() || "eng_us";

        // All the skills should be loaded, so just get em from the cache
        if (opts.min) {
            return (await cache.get(
                env.MONGODB_SWAPI_DB,
                "abilities",
                { skillId: { $in: skillArr }, language: thisLang },
                { nameKey: 1, _id: 0 },
            )) as { nameKey: string }[];
        }
        const cacheRes = (await cache.get(
            env.MONGODB_SWAPI_DB,
            "abilities",
            {
                skillId: { $in: skillArr },
                language: thisLang as never,
            },
            {
                _id: 0,
                updated: 0,
            },
        )) as ComlinkAbility[];
        return cacheRes;
    }

    // Grab all of a character's info in the given language (Name, Abilities, Equipment)
    async getCharacter(defId: string, lang: SWAPILang = "eng_us") {
        // Make sure it's lowercase
        const thisLang: SWAPILang = (lang ? lang.toLowerCase() : "eng_us") as SWAPILang;

        if (!defId) throw new Error("[getCharacter] Missing character ID.");

        const char: RawCharacter = await this.character(defId);

        if (!char) throw new Error("[SWGoH-API getCharacter] Missing Character");
        if (!char.skillReferenceList) throw new Error("[SWGoH-API getCharacter] Missing character abilities");

        for (const s of char.skillReferenceList) {
            let skill = (await this.abilities([s.skillId], thisLang)) as unknown as ComlinkAbility;
            if (Array.isArray(skill)) skill = skill[0];

            if (!skill) {
                logger.log(s);
                logger.error("[swapi getCharacter] Missing ability - ");
                logger.error(s);
                throw new Error(`Missing character ability ${s.skillId}`);
            }
            s.isZeta = skill.isZeta;
            s.isOmicron = skill.isOmicron;
            s.name = skill.nameKey.replace(/\\n/g, " ").replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g, "");
            s.cooldown = skill.cooldown;
            s.desc = skill.descKey.replace(/\\n/g, " ").replace(/(\[\/*c*-*\]|\[[\w\d]{6}\])/g, "");
            const abTierCount = skill.abilityTiers?.length;
            if (abTierCount && skill.abilityTiers[abTierCount - 1].includes(skill.abilityTiers[abTierCount - 2])) {
                s.zetaDesc = skill.abilityTiers[abTierCount - 1].replace(skill.abilityTiers[abTierCount - 2], "").trim();
            }
            if (skill.tierList.length) {
                s.cost = {};
                for (const tier of skill.tierList) {
                    if (abilityCosts[tier]) {
                        for (const key of Object.keys(abilityCosts[tier])) {
                            s.cost[key] = s.cost[key] ? s.cost[key] + abilityCosts[tier][key] : abilityCosts[tier][key];
                        }
                    }
                }
            }
        }

        for (const tier of char.unitTierList) {
            const eqList = await this.gear(tier.equipmentSetList, thisLang);
            for (const [ix, e] of tier.equipmentSetList.entries()) {
                const eq = eqList.find((equipment) => equipment.id === e);
                if (!eq) {
                    logger.error(
                        `Missing equipment for char ${char.baseId}, make sure to update the gear lang stuff: ${JSON.stringify(e)}`,
                    );
                    continue;
                }
                tier.equipmentSetList.splice(ix, 1, eq.nameKey);
            }
        }

        return char;
    }

    // Function for updating all the stored character data from the game
    async character(defId: string): Promise<RawCharacter> {
        const outChar = (await cache.getOne(env.MONGODB_SWAPI_DB, "characters", { baseId: defId }, { _id: 0, updated: 0 })) as RawCharacter;
        return outChar;
    }

    // Get the gear for a given character
    async gear(gearArray: string | string[], lang: SWAPILang): Promise<SWAPIGear[]> {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!gearArray) {
            throw new Error("You need to have a list of gear here");
        }
        const gearArr = Array.isArray(gearArray) ? gearArray : [gearArray];

        // All the skills should be loaded, so just get em from the cache
        return await cache.get(
            env.MONGODB_SWAPI_DB,
            "gear",
            {
                id: { $in: gearArr },
                language: thisLang.toLowerCase() as never,
            },
            {
                _id: 0,
                updated: 0,
            },
        );
    }

    /**
     * Localized datacron text (set names + ability name/desc), keyed by localization key.
     * The structure lives in data/datacrons.json; this supplies the per-language text to render it.
     */
    async datacronText(lang: SWAPILang = "eng_us"): Promise<Map<string, string>> {
        const thisLang = lang?.toLowerCase() || "eng_us";
        const rows = (await cache.get(env.MONGODB_SWAPI_DB, "datacrons", { language: thisLang as never }, { key: 1, text: 1, _id: 0 })) as {
            key: string;
            text: string;
        }[];
        return new Map(rows.map((r) => [r.key, r.text]));
    }

    // Used by farm, randomchar, and reloaddata
    async units(defId: string, lang: SWAPILang = "eng_us"): Promise<SWAPIUnit> {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!defId) throw new Error("You need to specify a defId");

        // All the skills should be loaded, so just get em from the cache
        const uOut = (await cache.getOne(
            env.MONGODB_SWAPI_DB,
            "units",
            { baseId: defId, language: thisLang.toLowerCase() as never },
            {
                _id: 0,
                updated: 0,
            },
        )) as SWAPIUnit;
        return uOut;
    }

    /**
     * Batch fetch unit names for multiple defIds
     * @param defIds - Array of unit defIds (or single defId)
     * @param lang - Language code (default: eng_us)
     * @returns Map of defId to nameKey
     */
    async unitNames(defIds: string | string[], lang: SWAPILang = "eng_us"): Promise<Record<string, string>> {
        const thisLang = lang?.toLowerCase() || "eng_us";
        const defIdArray = Array.isArray(defIds) ? defIds : [defIds];

        if (!defIdArray.length) return {};

        const units = (await cache.get(
            env.MONGODB_SWAPI_DB,
            "units",
            { baseId: { $in: defIdArray }, language: thisLang },
            { baseId: 1, nameKey: 1, _id: 0 },
        )) as { baseId: string; nameKey: string }[];

        // Convert array to map for easy lookup
        const nameMap: Record<string, string> = {};
        for (const unit of units) {
            nameMap[unit.baseId] = unit.nameKey;
        }

        return nameMap;
    }

    // Get gear recipes
    async recipes(recArray: number | number[], lang: SWAPILang): Promise<SWAPIRecipe[]> {
        const thisLang = lang?.toLowerCase() || "eng_us";
        if (!recArray) {
            throw new Error("You need to have a list of gear here");
        }
        const recArr = (Array.isArray(recArray) ? recArray : [recArray]).map((r) => r.toString());

        // All the skills should be loaded, so just get em from the cache
        return await cache.get(
            env.MONGODB_SWAPI_DB,
            "recipes",
            {
                id: { $in: recArr },
                language: thisLang as never,
            },
            {
                _id: 0,
                updated: 0,
            },
        );
    }

    async getRawGuild(
        allyCode: number,
        cooldown: PlayerCooldown = { player: this.playerMaxCooldown, guild: this.guildMaxCooldown },
        { forceUpdate, priority }: { forceUpdate?: boolean; priority?: Priority } = {},
    ) {
        priority ??= PRIORITY.PUBLIC_COMMAND;
        const tempGuild: RawGuild = {} as RawGuild;
        const thisAc = allyCode?.toString().replace(/[^\d]/g, "");
        if (!thisAc || Number.isNaN(thisAc) || thisAc.length !== 9) {
            throw new Error("Please provide a valid ally code");
        }

        // Not routed through tryCall: this is a single user-facing lookup, so a failure must
        // surface as an error rather than being swallowed into a null the caller misreads as
        // "no such player".
        const player = (await withStub(priority, (stub) => stub.getPlayer(thisAc))) as ComlinkPlayer;
        if (!player) throw new Error("I cannot find a matching profile for this ally code, please make sure it's typed in correctly");

        if (!player.guildId) throw new Error("This player is not in a guild");

        let rawGuild: RawGuild | null = await cache.getOne(env.MONGODB_SWAPI_DB, "rawGuilds", { id: player.guildId });
        if (
            forceUpdate ||
            !rawGuild ||
            !rawGuild.roster ||
            !rawGuild.roster.length ||
            !rawGuild.profile ||
            this.isExpired(rawGuild.updated, cooldown, true)
        ) {
            rawGuild = (await withStub(priority, (stub) => stub.getGuild(player.guildId, true))) as RawGuild;

            // The comlink API wraps the whole payload under a 'guild' key; unwrap it
            // so the loop below iterates the real guild fields (profile, member, ...)
            rawGuild = (rawGuild.guild ?? rawGuild) as RawGuild;
            const ignoreArr = [
                "inviteStatus",
                "raidStatus",
                "raidResult",
                "territoryBattleStatus",
                "guildEvents",
                "territoryBattleResult",
                "territoryWarStatus",
                "roomAvailable",
                "arcadeRaidStatus",
                "stat",
                "recentRaidResult",
                "recentTerritoryWarResult",
            ];

            // Only keep the useful parts of this mess
            for (const key of Object.keys(rawGuild)) {
                if (key === "member") {
                    tempGuild.roster = [];
                    for (const member of rawGuild.member) {
                        const tempMember: RawGuildMember = {} as RawGuildMember;
                        const contribution = {} as SWAPIGuildAlteredMemberContribution;
                        for (const contType of member.memberContribution) {
                            contribution[String(contType.type) as keyof SWAPIGuildAlteredMemberContribution] = {
                                currentValue: contType.currentValue,
                                lifetimeValue: contType.lifetimeValue,
                            };
                        }
                        tempMember.memberContribution = contribution;
                        tempMember.playerName = member.playerName;
                        tempMember.lastActivityTime = member.lastActivityTime;
                        tempMember.playerId = member.playerId;
                        tempGuild.roster.push(tempMember);
                    }
                } else if (!ignoreArr.includes(key)) {
                    (tempGuild as unknown as Record<string, unknown>)[key] = rawGuild[key as keyof RawGuild];
                }
            }
            if (!tempGuild.roster) tempGuild.roster = [];
            rawGuild = await cache.put(env.MONGODB_SWAPI_DB, "rawGuilds", { id: player.guildId }, tempGuild);
        }

        if (!rawGuild) throw new Error("Sorry, that player is not in a guild");

        // If it got this far, there's at least some sort of guild resposne there
        return rawGuild;
    }

    private filterGuildRoster(guild: SWAPIGuild): SWAPIGuild {
        guild.roster = guild.roster.filter((m) => m.guildMemberLevel > 1);
        const oldLen = guild.roster.length;
        guild.roster = guild.roster.filter((m) => m.allyCode !== null);
        if (guild.roster.length !== oldLen) {
            logger.log(`[swapi/guild] Filtered ${oldLen - guild.roster.length} members with null ally codes`);
        }
        return guild;
    }

    async guild(allyCode: number | string, cooldown?: PlayerCooldown, priority: Priority = PRIORITY.PUBLIC_COMMAND) {
        const thisAcStr = allyCode?.toString().replace(/[^\d]/g, "");
        if (thisAcStr?.length !== 9 || Number.isNaN(thisAcStr)) throw new Error("Please provide a valid ally code");
        const thisAc = Number.parseInt(thisAcStr, 10);

        /** Get player from cache */
        let player: SWAPIPlayer | SWAPIPlayer[] = await this.unitStats(thisAc, undefined, { force: false, priority });
        if (Array.isArray(player)) player = player[0];
        if (!player) {
            throw new Error("I don't know this player, make sure they're registered first");
        }
        if (!player.guildId) throw new Error("Sorry, that player is not in a guild");

        const guild: SWAPIGuild | null = await cache.getOne(env.MONGODB_SWAPI_DB, "guilds", { id: player.guildId });

        /** Check if existance and expiration */
        if (!guild || this.isExpired(guild.updated, cooldown, true)) {
            /** If not found or expired, fetch new from API and save to cache */
            let tempGuild: SWAPIGuild;
            try {
                tempGuild = await this.fetchGuild(player.guildId, priority);
            } catch (err) {
                // Probably API timeout
                logger.error(
                    `[SWAPI-guild] Couldn't update guild for: ${player.name}: ${err instanceof Error ? err.message : String(err)}`,
                );
                throw err;
            }
            // logger.log(`Updated ${player.name} from ${tempGuild[0] ? tempGuild[0].name + ", updated: " + tempGuild[0].updated : "????"}`);

            if (Array.isArray(tempGuild)) {
                tempGuild = tempGuild[0];
                if (tempGuild?._id) tempGuild._id = undefined; // Delete this since it's always whining about it being different
            }

            if (!tempGuild?.roster || !tempGuild.name) {
                logger.error(
                    `[SWAPI-guild] Fresh fetch returned empty roster or no name. roster: ${tempGuild?.roster?.length || 0}, name: ${tempGuild?.name || "none"}`,
                );
                if (guild?.roster) {
                    logger.log(`[SWAPI-guild] Falling back to cached guild with ${guild.roster.length} members`);
                    return this.filterGuildRoster(guild);
                }
                // logger.log("Broke getting tempGuild: " + inspect(tempGuild.error));
                // throw new Error("Could not find your guild. The API is likely overflowing.");
            }

            if (tempGuild.roster?.length !== tempGuild.members) {
                logger.error(`[swgohAPI-guild] Missing players, only getting ${tempGuild.roster?.length}/${tempGuild.members}`);
            }
            await cache.put(env.MONGODB_SWAPI_DB, "guilds", { id: tempGuild.id }, tempGuild);
            return this.filterGuildRoster(tempGuild);
        }
        /** If found and valid, serve from cache */
        return this.filterGuildRoster(guild);
    }

    private async fetchGuild(guildId: string, priority: Priority = PRIORITY.PUBLIC_COMMAND) {
        const comlinkGuild = (await withStub(priority, (stub) => stub.getGuild(guildId, true))) as unknown as ComlinkGuildResponse;

        const formattedGuild = await this.formatGuild(comlinkGuild, priority);
        return formattedGuild;
    }

    private async formatGuild({ guild, raidLaunchConfig, ...topRest }: ComlinkGuildResponse, priority: Priority = PRIORITY.PUBLIC_COMMAND) {
        const { profile, guildEventTracker, nextChallengesRefresh, recentTerritoryWarResult, recentRaidResult, member, ...guildRest } =
            guild;
        const {
            id,
            name,
            externalMessageKey,
            memberCount,
            enrollmentStatus,
            levelRequirement,
            bannerColorId,
            bannerLogoId,
            internalMessage,
            guildGalacticPower,
            ...profileRest
        } = profile;

        const raids: Record<string, unknown> = {};
        // if (raidLaunchConfig) {
        //     for (const { campaignMissionIdentifier, raidId } of raidLaunchConfig) {
        //         raids[raidId] = campaignMissionIdentifier.campaignMissionId;
        //     }
        // }
        if (recentRaidResult?.length) {
            for (const { identifier, guildRewardScore, raidId } of recentRaidResult) {
                raids[raidId] = {
                    diffId: identifier.campaignMissionId,
                    progress: guildRewardScore,
                };
            }
        }

        const members: SWAPIGuildMember[] = [];
        await eachLimit(
            member,
            MAX_BATCH_IN_FLIGHT,
            async ({
                playerId,
                memberLevel,
                memberContribution,
                ...rest
            }: {
                playerId: string;
                memberLevel: number;
                memberContribution: number;
            }) => {
                // Grab each player and process their info
                try {
                    // A transient blip here silently drops the member from the guild roster, so
                    // swapiServe retries before giving up - see BUG_REFERENCE.md
                    const player = await tryCall<ComlinkPlayer>(
                        priority,
                        "formatGuild-getPlayer",
                        (detail) => `[formatGuild] Failed to fetch player ${playerId}: ${detail}`,
                        (stub) => stub.getPlayer(null, playerId) as Promise<ComlinkPlayer>,
                    );
                    if (!player) return;
                    const { name, level, allyCode, profileStat } = player;

                    let gp = 0;
                    let gpChar = 0;
                    let gpShip = 0;
                    for (const stat of profileStat ?? []) {
                        if (stat.nameKey === "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME") {
                            gpShip = Number(stat.value);
                        } else if (stat.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME") {
                            gp = Number(stat.value);
                        } else if (stat.nameKey === "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME") {
                            gpChar = Number(stat.value);
                        }
                        if (gp && gpChar && gpShip) break;
                    }

                    members.push({
                        // The eachLimit callback param under-declares the raw API member shape, so
                        // `...rest` carries the remaining SWAPIGuildMember fields the type can't see here.
                        ...rest,
                        id: playerId,
                        guildMemberLevel: memberLevel,
                        memberContribution,
                        name,
                        level,
                        allyCode: Number(allyCode),
                        gp,
                        gpChar,
                        gpShip,
                        updated: Date.now(),
                    } as unknown as SWAPIGuildMember);
                } catch (err) {
                    // The fetch itself reports its own give-up above, so anything reaching here
                    // came from formatting the member rather than retrieving them
                    logger.error(`[formatGuild] Failed to process player ${playerId}: ${err instanceof Error ? err.message : String(err)}`);
                }
            },
        );

        return {
            ...profileRest,
            ...topRest,
            ...guildRest,
            id,
            name,
            desc: externalMessageKey,
            members: memberCount,
            status: enrollmentStatus,
            required: levelRequirement,
            bannerColor: bannerColorId,
            bannerLogo: bannerLogoId,
            message: internalMessage,
            gp: Number(guildGalacticPower),
            raid: raids,
            roster: members,
            updated: Date.now(),
            recentTerritoryWarResult,
            nextChallengesRefresh,
            guildEventTracker,
            raidLaunchConfig,
        } as unknown as SWAPIGuild;
    }

    async zetaRec(lang = "ENG_US") {
        const zetas = await cache.getOne(env.MONGODB_SWAPI_DB, "zetaRec", { lang: lang });
        return zetas?.zetas;
    }

    private isExpired(lastUpdated: number | undefined, cooldown: PlayerCooldown | undefined, guild = false): boolean {
        if (!lastUpdated) return true;
        let thisCooldown = this.guildMaxCooldown;

        if (guild) {
            // If it's for a guild, apply the guild cooldown
            thisCooldown = cooldown?.guild || this.guildMaxCooldown;
            if (thisCooldown > this.guildMaxCooldown) thisCooldown = this.guildMaxCooldown;
            if (thisCooldown < this.guildMinCooldown) thisCooldown = this.guildMinCooldown;
        } else {
            // Otherwise, apply the player cooldown
            thisCooldown = cooldown?.player || this.playerMaxCooldown;
            if (thisCooldown > this.playerMaxCooldown) thisCooldown = this.playerMaxCooldown;
            if (thisCooldown < this.playerMinCooldown) thisCooldown = this.playerMinCooldown;
        }

        const diff = convertMS(Date.now() - new Date(lastUpdated).getTime());
        return diff.totalMin >= thisCooldown;
    }
}

// Create and export a singleton instance
const swapi = new SWAPI();

export default swapi;
export { SWAPI };
