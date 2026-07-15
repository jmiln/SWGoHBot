import { readdir, unlink, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { inspect } from "node:util";
import { eachLimit } from "async";
import { ApplicationCommandOptionType } from "discord.js";
import { type AnyBulkWriteOperation, MongoClient } from "mongodb";
import { FixedQueue, Piscina } from "piscina";
import { env } from "../config/config.ts";
import cache from "../modules/cache.ts";
import databaseCleanup from "../modules/databaseCleanup.ts";
import { readJSON, toProperCase } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";

const DEBUG_LOGS = process.argv.includes("--debug") || false;

// Run the game data updaters even when the metadata is unchanged. Without this the whole gamedata
// path (including the character/ship file rebuild) is skipped on an unchanged version, so there's
// no way to re-derive those files on demand.
const FORCE_GAMEDATA = process.argv.includes("--force-gamedata") || false;

// Skip the mod updaters, which fetch every player in the top 100 guilds and dominate the cycle's
// runtime. Everything else in the cycle is independent of them.
const SKIP_MODS = process.argv.includes("--skip-mods") || false;

// databaseCleanup deletes old player stats/guilds/rosters, so it's opt-in rather than opt-out: a
// manual run must never quietly destroy data. The scheduled run passes this (dataUpdater.config.cjs).
const RUN_CLEANUP = process.argv.includes("--cleanup") || false;

// Parse a numeric `--flag value` CLI override, falling back to a default when absent or unparseable.
function numericArg(flag: string, fallback: number): number {
    const ix = process.argv.indexOf(flag);
    if (ix === -1) return fallback;
    const parsed = Number.parseInt(process.argv[ix + 1], 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

// Maximum concurrent API requests to prevent rate limiting and excessive memory usage.
// Up to 120 seems to work ok, and cuts off 6 or so seconds of processing time, but it's just
// not worth the risk of rate limits.
const MAX_CONCURRENT = numericArg("--max-concurrent", 80);

// Player-fetch worker pool (see aggregatePlayerMods). One isolate per concurrent request gives the
// parse parallelism the workload needs (parsing each full-player payload is real CPU, not just
// I/O), so the thread count tracks the host's available cores -- but it is capped, because the
// fetch is API rate-limit bound and must NOT scale up on bigger hardware. The cap is the validated
// safe concurrency; do not raise it. Each worker's V8 old space is also capped so transient
// payloads get collected instead of ballooning rss: the live set per worker is single-digit MB,
// but with no memory pressure V8 grew the (default CPU-count) isolates freely until they hit ~5GB.
// All three knobs are overridable per run (--mod-threads / --mod-tasks / --worker-heap) for tuning;
// the defaults are the verified config (12 threads, 1 task each, 256MB cap -> ~1.4GB peak).
const MOD_FETCH_CONCURRENCY_CAP = 12;
const MOD_WORKER_THREADS = numericArg("--mod-threads", Math.max(1, Math.min(availableParallelism(), MOD_FETCH_CONCURRENCY_CAP)));
const MOD_TASKS_PER_WORKER = numericArg("--mod-tasks", 1);
const MOD_WORKER_HEAP_MB = numericArg("--worker-heap", 256);

import ComlinkStub from "@swgoh-utils/comlink";
import type { components, operations } from "../types/comlinkGamedata.js";
import type { HelpJSON } from "../types/help_types.ts";
import type { ComlinkAbility, FeatureStore, SWAPILang, SWAPIUnit } from "../types/swapi_types.ts";
import type { BotUnit, BotUnitMods, JourneyReqs, Location, OmicronCategories, UnitLocation, UnitSide } from "../types/types.ts";

interface Metadata {
    assetVersion: string;
    latestGamedataVersion: string;
    latestLocalizationBundleVersion: string;
}
interface ModMap {
    [key: string]: {
        pips: number;
        set: string;
        slot: number;
    };
}
interface RecipeMap {
    id: string;
    descKey: string;
    ingredients: components["schemas"]["BucketItem"][];

    // Added later before storage
    language?: SWAPILang;
}
interface ProcessedUnit {
    baseId: string;
    nameKey: string;
    skillReferenceList: components["schemas"]["SkillDefinitionReference"][];
    categoryIdList: string[];
    combatType: components["schemas"]["CombatType"];
    unitTierList: {
        requiredTier?: components["schemas"]["UnitTier"];
        equipmentSetList: string[];
    }[];
    crewList: components["schemas"]["CrewMember"][];
    creationRecipeReference: string;
    legend: boolean;

    // Added later before storage
    factions?: string[];
    crew?: string[];
    language?: SWAPILang;
}
type Locales = Record<SWAPILang, Record<string, string>>;

// Mission identifier stored on each material's lookup lists (a flattened campaign node reference).
interface CampaignMissionId {
    campaignId?: string;
    campaignMapId?: string;
    campaignNodeId?: string;
    campaignNodeDifficulty?: components["schemas"]["CampaignNodeDifficulty"];
    campaignMissionId?: string;
}
// Shape of the "materials" documents read back from the db in updateLocs (written by processMaterials).
interface MaterialLocationDoc {
    id: string;
    lookupMissionList: CampaignMissionId[];
    raidLookupList: CampaignMissionId[];
    iconKey: string;
}
// Loosely-typed swgoh-json-files blobs indexed by campaign identifiers.
type CampaignMapNames = Record<string, { game_mode?: string } | undefined>;
type CampaignMapNodes = Record<string, Record<string, Record<string, Record<string, Record<string, string | undefined>>>> | undefined>;

// Per-defId tally of how often each primary-stat layout and mod-set combination appears
// across all scanned rosters. Built incrementally by foldUnitMods, consumed by processModResults.
type UnitModAccumulator = Record<string, { primaries: Record<string, number>; sets: Record<string, number> }>;

// Simplified call for auto-generated types from comlink openapi.yaml
type GameData = operations["getGameData"]["responses"]["2XX"]["content"]["application/json"];
type getGuildLeaderboardResponse = operations["getGuildLeaderboard"]["responses"]["2XX"]["content"]["application/json"];
type getGuildResponse = operations["getGuild"]["responses"]["2XX"]["content"]["application/json"];
type comlinkComponents = components["schemas"];

const CHAR_COMBAT_TYPE = 1;
const SHIP_COMBAT_TYPE = 2;

const DATA_DIR_PATH = path.resolve(import.meta.dirname, "../data/");
const GAMEDATA_DIR_PATH = path.resolve(import.meta.dirname, "../data/gameDataFiles/");

const CHAR_FILE_PATH = path.join(DATA_DIR_PATH, "characters.json");
const CHAR_LOCATIONS_FILE_PATH = path.join(DATA_DIR_PATH, "charLocations.json");
const JOURNEY_FILE_PATH = path.join(DATA_DIR_PATH, "journeyReqs.json");
const RAID_NAMES_FILE_PATH = path.join(DATA_DIR_PATH, "raidNames.json");
const SHIP_FILE_PATH = path.join(DATA_DIR_PATH, "ships.json");
const SHIP_LOCATIONS_FILE_PATH = path.join(DATA_DIR_PATH, "shipLocations.json");
const UNIT_CHECKLIST_FILE_PATH = path.join(DATA_DIR_PATH, "unitChecklist.json");
const HELP_JSON_PATH = path.join(DATA_DIR_PATH, "help.json");

// The metadata keys we actually care about
const META_KEYS: (keyof Metadata)[] = ["assetVersion", "latestGamedataVersion", "latestLocalizationBundleVersion"];

// Track resources for cleanup
let mongoClient: MongoClient | null = null;

// Print usage and exit before any startup work when --help/-h is passed.
if (!process.env.TESTING_ENV && (process.argv.includes("--help") || process.argv.includes("-h"))) {
    printHelp();
    process.exit(0);
}

logger.log("Starting data updater");

// Centralized cleanup function
async function cleanup() {
    logger.log("Cleaning up resources...");

    // Awaited so an in-flight cleanup finishes its deletes before the db connection closes below.
    await databaseCleanup.stop();

    // Close MongoDB connection
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
    }

    logger.log("Cleanup complete");
}

// Helper function to add timeout to promises
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]);
}

// Run the updater when it's started, only if we're not running tests
if (!process.env.TESTING_ENV) {
    init();

    // catch ctrl+c event and exit normally
    process.on("SIGINT", async () => {
        logger.log("Received SIGINT, shutting down gracefully...");
        await cleanup();
        logger.log("Exiting.");
        process.exit(0);
    });

    // Handle SIGTERM (common in Docker/cloud environments)
    process.on("SIGTERM", async () => {
        logger.log("Received SIGTERM, shutting down gracefully...");
        await cleanup();
        logger.log("Exiting.");
        process.exit(0);
    });

    // Handle uncaught errors
    process.on("unhandledRejection", async (reason, promise) => {
        logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
        await cleanup();
        process.exit(1);
    });
}

async function init() {
    try {
        // Prevent double initialization
        if (mongoClient) {
            logger.log("Data updater already initialized");
            return;
        }

        mongoClient = await MongoClient.connect(env.MONGODB_URL);
        cache.init(mongoClient);
        if (RUN_CLEANUP) {
            databaseCleanup.start(24);
        } else {
            logger.log("Skipping database cleanup (pass --cleanup to run it)");
        }
        const comlinkStub = new ComlinkStub({
            url: env.SWAPI_CLIENT_URL,
            accessKey: env.SWAPI_ACCESS_KEY,
            secretKey: env.SWAPI_SECRET_KEY,
        });

        // Run the heavy update cycle once, then exit so the OS reclaims the memory the cycle
        // allocated. PM2 relaunches this daily via cron_restart (see ecosystem.config.cjs).
        await (async function runUpdaters() {
            let exitCode = 0;
            try {
                debugTime("Total update cycle");
                logMem("cycle start");

                debugTime("Checking metadata");
                const { isMetadataUpdated, newMetadata, oldMetadata } = await updateMetadata(DATA_DIR_PATH, comlinkStub);
                debugTimeEnd("Checking metadata");

                if (isMetadataUpdated || FORCE_GAMEDATA) {
                    const log: string[] = [];
                    if (oldMetadata.latestGamedataVersion !== newMetadata.latestGamedataVersion) {
                        log.push(` - GameData: ${oldMetadata.latestGamedataVersion} -> ${newMetadata.latestGamedataVersion}`);
                    }
                    if (oldMetadata.latestLocalizationBundleVersion !== newMetadata.latestLocalizationBundleVersion) {
                        log.push(
                            ` - Localization: ${oldMetadata.latestLocalizationBundleVersion} -> ${newMetadata.latestLocalizationBundleVersion}`,
                        );
                    }
                    if (oldMetadata.assetVersion !== newMetadata.assetVersion) {
                        log.push(` - Assets: ${oldMetadata.assetVersion} -> ${newMetadata.assetVersion}`);
                    }
                    if (log.length) {
                        logger.log(["Found new metadata, running updaters", ...log].join("\n"));
                    } else {
                        logger.log("Metadata unchanged, but --force-gamedata was passed; running game data updaters anyway");
                    }

                    debugTime("Running game data updaters");
                    await runGameDataUpdaters(newMetadata, comlinkStub);
                    debugTimeEnd("Running game data updaters");
                    debugLog("Finished running game data updater for new metadata");
                    logMem("after game data updaters");
                } else {
                    logMem("metadata unchanged, skipping game data updaters");
                }

                if (SKIP_MODS) {
                    logger.log("Skipping mod updaters (--skip-mods)");
                } else {
                    debugTime("Running mod updaters");
                    await runModUpdaters(comlinkStub);
                    debugTimeEnd("Running mod updaters");
                    logMem("after mod updaters");
                }

                debugTime("Exporting command docs");
                await exportCommandDocs();
                debugTimeEnd("Exporting command docs");

                debugLog("Finished running all updaters");

                debugTimeEnd("Total update cycle");
            } catch (error) {
                logger.error(`[dataUpdater] Update cycle failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
                exitCode = 1;
            } finally {
                await cleanup();
                process.exit(exitCode);
            }
        })();
    } catch (error) {
        logError("dataUpdater/init", "Failed to start the data updater:", error);
        await cleanup();
        throw error;
    }
}

// Update the metadata file if it exists, create it otherwise
async function updateMetadata(dataDir: string, comlinkStub: ComlinkStub) {
    const META_FILE = path.join(dataDir, "metadata.json");
    debugLog("Checking metadata");
    const newMetaData = await withTimeout(comlinkStub.getMetaData(), 30000, "getMetaData");

    // Validate metadata structure
    if (!newMetaData || typeof newMetaData !== "object") {
        throw new Error("[updateMetadata] Invalid metadata response - not an object");
    }

    // Validate required keys exist
    const missingKeys = META_KEYS.filter((key) => !(key in newMetaData));
    if (missingKeys.length > 0) {
        throw new Error(`[updateMetadata] Missing required metadata keys: ${missingKeys.join(", ")}`);
    }

    const metadataOut: Partial<Metadata> = {};
    let oldMetadata: Partial<Metadata> = {};
    try {
        oldMetadata = await readJSON<Partial<Metadata>>(META_FILE);
    } catch (error) {
        debugLog(`No existing metadata (${fsErrInfo(error)}). Creating new metadata.`);
    }
    const meta = newMetaData as Record<string, string>;
    let isMetadataUpdated = false;
    for (const key of META_KEYS) {
        if (meta[key] !== oldMetadata[key]) {
            isMetadataUpdated = true;
            debugLog(`Updating metadata ${key} from ${oldMetadata[key]} to ${meta[key]}`);
            metadataOut[key] = meta[key];
        } else {
            metadataOut[key] = oldMetadata[key];
        }
    }

    if (isMetadataUpdated) {
        await saveFile(META_FILE, metadataOut);
    }

    // metadataOut is built by copying every META_KEYS entry, so it satisfies Metadata by construction.
    return { isMetadataUpdated, newMetadata: metadataOut as Metadata, oldMetadata: oldMetadata as Metadata };
}

async function runModUpdaters(comlinkStub: ComlinkStub) {
    debugTime("Getting guildIds");
    const guildIds = await getGuildIds(comlinkStub);
    debugTimeEnd("Getting guildIds");

    // Grab the player IDs for each player in each of those guilds
    debugTime("Getting guildPlayerIds");
    const playerIds = await getGuildPlayerIds(comlinkStub, guildIds);
    debugTimeEnd("Getting guildPlayerIds");

    // Grab the defId and needed mod info for each of those players' units, folding each
    // player's mods into the per-defId aggregation as they stream in (see aggregatePlayerMods).
    // Records which sets of mods each character has and the primary stats per slot.
    debugTime("Aggregating player mods");
    const modMap = await readJSON<ModMap>(path.join(DATA_DIR_PATH, "modMap.json"));
    const unitsOut = await aggregatePlayerMods(playerIds, modMap);
    debugTimeEnd("Aggregating player mods");

    // Go through each character and find the most common versions of
    // set and primaries, and convert them to be readable
    debugTime("Processing modResults");
    const modsOut = processModResults(unitsOut);
    debugTimeEnd("Processing modResults");

    // Process each batch of mods and put them into the characters
    debugTime("Merging mods to characters");
    await mergeModsToCharacters(modsOut);
    debugTimeEnd("Merging mods to characters");
}

async function runGameDataUpdaters(metadata: Metadata, comlinkStub: ComlinkStub) {
    debugLog("Running gameData updater");
    const timestamp = Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZone: env.LOG_TIMEZONE,
    }).format(new Date());
    const log: string[] = [];

    const locales = await getLocalizationData(comlinkStub, metadata.latestLocalizationBundleVersion);
    logMem("after getLocalizationData (locales held)");

    // TODO Change updateGameData to return a log array so it can all be logged nicely with the locations?
    await updateGameData(locales, metadata, comlinkStub); // Run the stuff to grab all new game data, and update listings in the db
    debugLog("Finished processing gameData chunks");

    // Run unit locations updaters in parallel
    const [charLocsResult, shipLocsResult] = await Promise.all([
        updateLocs(CHAR_FILE_PATH, CHAR_LOCATIONS_FILE_PATH, locales),
        updateLocs(SHIP_FILE_PATH, SHIP_LOCATIONS_FILE_PATH, locales),
    ]);

    // Save if changes detected
    if (charLocsResult.hasChanges) {
        log.push("Detected a change in character locations.");
        await saveFile(CHAR_LOCATIONS_FILE_PATH, charLocsResult.locations);
    }
    if (shipLocsResult.hasChanges) {
        log.push("Detected a change in ship locations.");
        await saveFile(SHIP_LOCATIONS_FILE_PATH, shipLocsResult.locations);
    }

    if (log.length) {
        logger.log(`Ran updater - ${timestamp}`);
        logger.log(log.join("\n"));
    } else {
        debugLog(`Ran updater - ${timestamp}  ##  Nothing updated`);
    }
    debugLog("Finished running gameData updaters");
}

async function saveFile(filePath: string, jsonData: [] | object, doPretty = true) {
    try {
        const content = doPretty ? JSON.stringify(jsonData, null, 4) : JSON.stringify(jsonData);
        await writeFile(filePath, content);
    } catch (error) {
        logError("dataUpdater/saveFile", `Failed to save file ${filePath}:`, error);
        throw error;
    }
}

const setLang: Record<string, string> = {
    1: "Health",
    2: "Offense",
    3: "Defense",
    4: "Speed",
    5: "Crit. Chance",
    6: "Crit. Damage",
    7: "Potency",
    8: "Tenacity",
};
const statLang: Record<string, string> = {
    0: "None",
    1: "Health",
    2: "Strength",
    3: "Agility",
    4: "Tactics",
    5: "Speed",
    6: "Physical Damage",
    7: "Special Damage",
    8: "Armor",
    9: "Resistance",
    10: "Armor Penetration",
    11: "Resistance Penetration",
    12: "Dodge Chance",
    13: "Deflection Chance",
    14: "Physical Critical Chance",
    15: "Special Critical Chance",
    16: "Crit. Damage",
    17: "Potency",
    18: "Tenacity",
    19: "Dodge",
    20: "Deflection",
    21: "Physical Critical Chance",
    22: "Special Critical Chance",
    23: "Armor",
    24: "Resistance",
    25: "Armor Penetration",
    26: "Resistance Penetration",
    27: "Health Steal",
    28: "Protection",
    29: "Protection Ignore",
    30: "Health Regeneration",
    31: "Physical Damage",
    32: "Special Damage",
    33: "Physical Accuracy",
    34: "Special Accuracy",
    35: "Physical Critical Avoidance",
    36: "Special Critical Avoidance",
    37: "Physical Accuracy",
    38: "Special Accuracy",
    39: "Physical Critical Avoidance",
    40: "Special Critical Avoidance",
    41: "Offense",
    42: "Defense",
    43: "Defense Penetration",
    44: "Evasion",
    45: "Crit. Chance",
    46: "Accuracy",
    47: "Critical Avoidance",
    48: "Offense",
    49: "Defense",
    50: "Defense Penetration",
    51: "Evasion",
    52: "Accuracy",
    53: "Crit. Chance",
    54: "Critical Avoidance",
    55: "Health",
    56: "Protection",
    57: "Speed",
    58: "Counter Attack",
    59: "UnitStat_Taunt",
    61: "Mastery",
};
const slotNames = ["square", "arrow", "diamond", "triangle", "circle", "cross"];

async function getGuildIds(comlinkStub: ComlinkStub) {
    try {
        const guildLeaderboardRes = (await withTimeout(
            comlinkStub._postRequestPromiseAPI("/getGuildLeaderboard", {
                payload: {
                    leaderboardId: [{ leaderboardType: 3, monthOffset: 0 }],
                    count: 100,
                },
                enums: false,
            }),
            30000,
            "getGuildLeaderboard",
        )) as getGuildLeaderboardResponse;

        // Validate response structure
        if (!guildLeaderboardRes?.leaderboard?.[0]?.guild) {
            throw new Error("Invalid leaderboard response structure");
        }

        return guildLeaderboardRes.leaderboard[0].guild.map((guild) => guild.id).filter((id): id is string => id !== undefined);
    } catch (error) {
        logger.error(
            `[dataUpdater/getGuildIds] Failed to fetch guild leaderboard: ${error instanceof Error ? error.stack || error.message : String(error)}`,
        );
        throw error; // Re-throw to let caller handle
    }
}

async function getGuildPlayerIds(comlinkStub: ComlinkStub, guildIds: string[]) {
    const playerIdArr: string[] = [];
    let failedGuilds = 0;

    // Get all the players' IDs from each guild
    await eachLimit(guildIds, MAX_CONCURRENT, async (guildId) => {
        try {
            const { guild } = (await withTimeout(comlinkStub.getGuild(guildId), 30000, `getGuild(${guildId})`)) as getGuildResponse;

            // Validate response structure
            if (!guild?.member) {
                logger.warn(`[dataUpdater/getGuildPlayerIds] Invalid guild data for ${guildId}`);
                failedGuilds++;
                return;
            }

            const playerIds = guild.member.map((player) => player.playerId).filter((id): id is string => id !== undefined);
            playerIdArr.push(...playerIds);
        } catch (error) {
            logger.error(
                `[dataUpdater/getGuildPlayerIds] Failed to fetch guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`,
            );
            failedGuilds++;
        }
    });

    if (failedGuilds > 0) {
        logger.warn(`[dataUpdater/getGuildPlayerIds] Failed to fetch ${failedGuilds}/${guildIds.length} guilds`);
    }

    return playerIdArr;
}

// Fetch each player's stripped roster and fold its mods straight into the per-defId
// aggregation as it arrives, so we never hold every player's units in memory at once.
// Peak memory is bounded by the MAX_CONCURRENT in-flight rosters plus the small accumulator.
async function aggregatePlayerMods(playerIds: string[], modMap: ModMap): Promise<UnitModAccumulator> {
    debugLog(`Aggregating mods for ${playerIds.length} players (${MAX_CONCURRENT} at a time)`);
    const unitsOut: UnitModAccumulator = {};

    let failedCount = 0;
    let processedCount = 0;

    // Create pool locally for this operation. Thread count follows the host cores up to the
    // rate-limit cap (MOD_WORKER_THREADS), instead of Piscina's raw CPU-count default, and each
    // worker's heap is capped so transient payloads are collected instead of accumulating.
    const piscina = new Piscina({
        filename: path.resolve(import.meta.dirname, "../modules/workers/getStrippedModsWorker.ts"),
        taskQueue: new FixedQueue(),
        minThreads: MOD_WORKER_THREADS,
        maxThreads: MOD_WORKER_THREADS,
        concurrentTasksPerWorker: MOD_TASKS_PER_WORKER,
        resourceLimits: { maxOldGenerationSizeMb: MOD_WORKER_HEAP_MB },
    });
    logMem(
        `aggregatePlayerMods start (piscina threads=${piscina.threads.length}, tasksPerWorker=${MOD_TASKS_PER_WORKER}, heapCap=${MOD_WORKER_HEAP_MB}MB)`,
    );

    try {
        await eachLimit(playerIds, MAX_CONCURRENT, async (playerId) => {
            try {
                const strippedUnits = (await piscina.run({ playerId, modMap })) as SWAPIUnit[] | undefined;
                // Fold synchronously here: eachLimit callbacks only interleave at the await
                // above, so mutating the shared accumulator is safe and the player's units
                // become eligible for GC as soon as this returns.
                if (strippedUnits?.length) foldUnitMods(unitsOut, strippedUnits);
            } catch (err) {
                failedCount++;
                logger.error(
                    `[dataUpdater/aggregatePlayerMods] Failed to process player ${playerId}: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
            // Sample memory periodically to catch any transient peak from in-flight worker payloads
            if (++processedCount % 1000 === 0) logMem(`aggregatePlayerMods after ${processedCount} players`);
        });

        if (failedCount > 0) {
            logger.error(`[dataUpdater/aggregatePlayerMods] Failed to process ${failedCount}/${playerIds.length} players`);
        }
    } finally {
        // Always close, even if errors occurred
        await piscina.close();
        debugLog("Closed worker pool");
    }

    return unitsOut;
}

// Fold one batch of stripped units (typically a single player's roster) into the running
// accumulator, mutating it in place. Records, per defId, how often each primary-stat layout
// and each mod-set combination appears so processModResults can pick the most common later.
function foldUnitMods(unitsOut: UnitModAccumulator, unitsIn: SWAPIUnit[]): UnitModAccumulator {
    for (const unit of unitsIn) {
        const { mods, defId } = unit;
        if (!mods?.length) continue;
        if (!unitsOut[defId]) {
            unitsOut[defId] = { primaries: {}, sets: {} };
        }

        // Build primaryStr and count sets in a single pass over mods
        const primaryParts: string[] = [];
        const unitSets: Record<string, number> = {};
        for (let i = 0; i < mods.length; i++) {
            const mod = mods[i];
            primaryParts.push(`${i + 1}-${mod.primaryStat}`);
            incrementInObj(unitSets, mod.set);
        }

        const primaryStr = primaryParts.join("_");
        if (!primaryStr.length) continue;
        incrementInObj(unitsOut[defId].primaries, primaryStr);

        // Build setStr efficiently
        const setParts: string[] = [];
        for (const [set, count] of Object.entries(unitSets)) {
            setParts.push(`${count}x${set}`);
        }
        const setStr = setParts.join("_");
        if (!setStr.length) continue;
        incrementInObj(unitsOut[defId].sets, setStr);
    }

    return unitsOut;
}

function incrementInObj(obj: Record<string, number>, key: string | number) {
    obj[key] = obj[key] ? obj[key] + 1 : 1;
    return obj;
}

const multiSets: Record<string, string[]> = {
    "Crit. Chance x4": ["Crit. Chance x2", "Crit. Chance x2"],
    "Crit. Chance x6": ["Crit. Chance x2", "Crit. Chance x2", "Crit. Chance x2"],
    "Defense x4": ["Defense x2", "Defense x2"],
    "Defense x6": ["Defense x2", "Defense x2", "Defense x2"],
    "Health x4": ["Health x2", "Health x2"],
    "Health x6": ["Health x2", "Health x2", "Health x2"],
    "Potency x4": ["Potency x2", "Potency x2"],
    "Potency x6": ["Potency x2", "Potency x2", "Potency x2"],
    "Tenacity x4": ["Tenacity x2", "Tenacity x2"],
    "Tenacity x6": ["Tenacity x2", "Tenacity x2", "Tenacity x2"],
};

// For each character, get rid of all but the most common results (If more than one tie, return both)
function processModResults(unitsIn: {
    [defId: string]: {
        primaries: {
            [key: string]: number;
        };
        sets: {
            [key: string]: number;
        };
    };
}) {
    const unitsOut: Record<string, { mods: BotUnitMods }> = {};
    for (const defId of Object.keys(unitsIn)) {
        const thisUnit = unitsIn[defId];
        const { primaries, sets } = thisUnit;

        const maxPrimaryCount = Math.max(...Object.values(primaries));
        const maxSetCount = Math.max(...Object.values(sets));

        const filteredPrimaries = Object.entries(primaries)
            .filter(([_, count]) => count === maxPrimaryCount)
            .map(([prim]) => prim.split("_"));
        const primariesOut: Record<string, string> = {};
        const primarySlots = filteredPrimaries[0] || [];
        for (const [ix, slot] of primarySlots.entries()) {
            const stat = slot.split("-")[1];
            primariesOut[slotNames[ix]] = statLang[stat];
        }

        const filteredSets = Object.entries(sets)
            .filter(([_, count]) => count === maxSetCount)
            .map(([set]) => set.split("_"));
        const totalSets = filteredSets[0] || [];
        const setStrings = totalSets.map((set) => {
            const [count, stat] = set.split("x");
            return `${setLang[stat]} x${count}`;
        });

        const setsOut: string[] = [];
        for (const set of setStrings) {
            if (multiSets[set]) {
                setsOut.push(...multiSets[set]);
            } else {
                setsOut.push(set);
            }
        }

        // Assign both primaries and sets to mods. primariesOut holds the per-slot primary stats
        // keyed by slot name, which together with sets forms the BotUnitMods shape.
        unitsOut[defId] = {
            mods: {
                ...primariesOut,
                sets: setsOut,
            } as unknown as BotUnitMods,
        };
    }
    return unitsOut;
}

async function mergeModsToCharacters(modsIn: { [defId: string]: { mods: BotUnitMods } }) {
    const characters = await readJSON<BotUnit[]>(CHAR_FILE_PATH);

    // Build lookup map for O(1) access
    const charsByUniqueName = new Map(characters.map((ch) => [ch.uniqueName, ch]));

    for (const defId of Object.keys(modsIn)) {
        const thisChar = charsByUniqueName.get(defId);
        if (!thisChar) continue;
        thisChar.mods = modsIn[defId].mods;
    }

    await saveFile(CHAR_FILE_PATH, characters);
}

async function updateLocs(
    unitListFile: string,
    currentLocFile: string,
    locales: Locales,
): Promise<{ locations: UnitLocation[]; hasChanges: boolean }> {
    debugLog(`Updating unit locations for ${unitListFile}`);
    const [currentUnits, currentLocs] = await Promise.all([readJSON<BotUnit[]>(unitListFile), readJSON<UnitLocation[]>(currentLocFile)]);

    const shardNameMap = currentUnits.map((unit) => `unitshard_${unit.uniqueName}`);
    const shardNameRes = await cache.get<MaterialLocationDoc>(env.MONGODB_SWAPI_DB, "materials", { id: { $in: shardNameMap } });

    const matArr: { defId: string; mats: MaterialLocationDoc }[] = [];
    for (const unit of currentUnits) {
        const res = shardNameRes.find((mat) => mat?.id === `unitshard_${unit.uniqueName}`);
        if (res) {
            matArr.push({
                defId: unit.uniqueName,
                mats: res,
            });
        }
    }

    if (!matArr.length) return { locations: [], hasChanges: false };

    const langList = Object.keys(locales);
    const targets = {
        HARD_DARK: ["FeatureTitle_DarkCampaigns", "DIFF_HARD"],
        HARD_FLEET: ["FeatureTitle_ShipPve", "DIFF_HARD"],
        HARD_LIGHT: ["FeatureTitle_LightCampaigns", "DIFF_HARD"],
        CANTINA: ["KEYBINDING_NAME_CANTINA_BATTLES"],
        // CANTINA: ["FeatureTitle_DatacronBattles"],
    };
    const bulkLocPut: AnyBulkWriteOperation[] = [];
    for (const lang of langList) {
        for (const target of Object.keys(targets)) {
            const langKey = targets[target as keyof typeof targets]
                .map((t: string) => locales[lang as keyof Locales][t] || `ERROR: ${t}`)
                .join(" ");
            bulkLocPut.push({
                updateOne: {
                    filter: { id: target, language: lang },
                    update: {
                        $set: { id: target, language: lang, langKey },
                    },
                    upsert: true,
                },
            });
        }
    }
    await cache.putMany(env.MONGODB_SWAPI_DB, "locations", bulkLocPut);

    const [campaignMapNames, campaignMapNodes, featureStoreList] = await Promise.all([
        readJSON<CampaignMapNames[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/campaignMapNames.json")).then((data) => data[0]),
        readJSON<CampaignMapNodes[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/campaignMapNodes.json")).then((data) => data[0]),
        readJSON<FeatureStore[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/featureStoreList.json")),
    ]);

    const outArr: { defId: string; locations: Location[] }[] = [];
    const bulkEventLocPut: AnyBulkWriteOperation[] = [];
    for (const mat of matArr) {
        const missions = mat?.mats?.lookupMissionList || [];

        const charArr: Location[] = [];
        const usedLocId = new Set();
        for (const node of missions) {
            // Every campaign mission identifier carries these three; skip any malformed entry so the
            // narrowed string fields can be used directly below.
            if (!node?.campaignId || !node.campaignMapId || !node.campaignNodeId) continue;
            // Capture the narrowed value so closures below (e.g. .some()) keep the string type
            const campaignNodeId = node.campaignNodeId;

            let locId: string | null = null;
            let charObj: { type: string; locId: string | null; name?: string } = { type: "", locId: null };

            // Skip ones that haven't existed for years
            if (["BASICTRAINING"].includes(node.campaignMapId)) continue;
            if (["FLASH_LUKE"].includes(node.campaignNodeId)) continue;

            if (node.campaignId === "EVENTS") {
                if (node.campaignMapId === "MARQUEE") {
                    // Run through stuff for Marquee events
                    locId = resolveLocKey(`EVENT_MARQUEE_${node.campaignNodeId.split("_")[0]}_NAME`, locales.eng_us);
                    charObj = { type: "Marquee", locId };
                } else if (node.campaignMapId === "PROGRESSION") {
                    // Process the two progression events (GMY / EP)
                    locId = resolveLocKey(`PROGRESSIONEVENT_${node.campaignNodeId}_NAME`, locales.eng_us);
                    charObj = { type: "Legendary Event", locId };
                } else if (node.campaignMapId === "JOURNEY") {
                    const journeyKeys = ["JOURNEY_JEDIKNIGHTLUKE", "JOURNEY_DARTHREVAN"];
                    if (journeyKeys.some((key) => campaignNodeId.includes(key))) {
                        locId = resolveLocKey(`EVENT_JOURNEY_${mat.defId}_NAME`, locales.eng_us);
                    } else if (node.campaignNodeId === "HEROJOURNEY_SCAVENGERREY") {
                        locId = resolveLocKey("EVENT_HERO_SCAVENGERREY_NAME", locales.eng_us);
                    } else {
                        // CG has dropped some units' guide title outright (JEDIKNIGHTCAL), so fall
                        // back to the journey event's own name rather than losing the location.
                        locId =
                            resolveLocKey(`${mat.defId}_GUIDE_DETAILS_TITLE`, locales.eng_us) ??
                            resolveLocKey(`EVENT_JOURNEY_${mat.defId}_NAME`, locales.eng_us);
                    }
                    charObj = { type: "Hero's Journey", locId };
                } else if (node.campaignMapId === "LEGENDARY") {
                    if (["THE_FORCE_UNLEASHED", "DARK_TIMES"].includes(node.campaignNodeId)) {
                        locId = resolveLocKey(`${mat.defId}_JOURNEY_GUIDE_EVENT_TITLE`, locales.eng_us);
                    } else {
                        locId = resolveLocKey(`${mat.defId}_GUIDE_DETAILS_TITLE`, locales.eng_us);
                    }
                    charObj = { type: "Legendary Event", locId };
                } else if (node.campaignMapId === "EPIC") {
                    if (node.campaignNodeId === "CLASH_ON_KAMINO") {
                        locId = resolveLocKey(`EPIC_CONFRONTATION_${node.campaignNodeId}_NAME`, locales.eng_us);
                    } else {
                        locId = resolveLocKey(`MYTHICEVENT_${node.campaignNodeId}`, locales.eng_us);
                    }
                    charObj = { type: "Epic Confrontation", locId };
                } else if (node.campaignMapId === "HEROIC") {
                    locId = resolveLocKey(`EVENT_${node.campaignNodeId.replace("NODE_EVENT_", "")}_NAME`, locales.eng_us);
                    charObj = { type: "Heroic Event", locId };
                } else if (node.campaignMapId === "FLEETMASTERY") {
                    locId = resolveLocKey(`EVENT_FLEET_MASTERY_${mat.defId}_NAME`, locales.eng_us);
                    charObj = { type: "Fleet Event", locId };
                } else if (node.campaignMapId === "SCHEDULED") {
                    if (node.campaignNodeId === "CONQUEST_UNIT_TRIALS") {
                        // Process the Proving Grounds events
                        // - Really just localize "Proving Grounds" since the rest is just the unit's name
                        locId = resolveLocKey("EVENT_CONQUEST_UNIT_TRIALS_NAME", locales.eng_us);
                        charObj = { type: "Proving Grounds", locId };
                    } else if (node.campaignNodeId.includes("GHOSTS_OF_DATHOMIR")) {
                        locId = resolveLocKey("EVENT_HOLIDAY_GHOSTS_OF_DATHOMIR_NAME", locales.eng_us);
                        charObj = { type: "Special Event", locId };
                    } else if (node.campaignNodeId.startsWith("NODE_EVENT_ASSAULT")) {
                        locId = resolveLocKey(`EVENT_ASSAULT_${node.campaignNodeId.split("_").pop()}_NAME`, locales.eng_us);
                        charObj = { type: "Assault Battle Event", locId };
                    } else if (node.campaignNodeId.includes("GALACTIC_BOUNTY")) {
                        locId = resolveLocKey("EVENT_GALACTIC_BOUNTY_01_NAME", locales.eng_us);
                        charObj = { type: "Galactic Bounty Event", locId };
                    }
                } else if (node.campaignMapId === "GALACTIC") {
                    // Process galactic legends events
                    //  - Still not sure how to manage LORDVADER in place of VADER
                    const commonStr = node.campaignNodeId.replace("CAMPAIGN_", ""); // Replace junk
                    // Each base is version-resolved, so these are only the genuinely different shapes.
                    const possibleKeys = [`NODE_CAMPAIGN_${commonStr}_NAME`, `${commonStr}_NAME`, `EVENT_${mat.defId}_GALACTICLEGEND_NAME`];

                    for (const possible of possibleKeys) {
                        const resolved = resolveLocKey(possible, locales.eng_us);
                        if (resolved) {
                            locId = resolved;
                            break;
                        }
                    }

                    charObj = { type: "Galactic Ascension", locId };
                } else {
                    debugLog(`[updateLocs] Unknown campaign: ${node.campaignId} - ${node.campaignMapId} - ${node.campaignNodeId}`);
                    continue;
                }

                if (!locId || usedLocId.has(locId)) continue;
                usedLocId.add(locId);

                // Go through and save all the locale strings into the db
                let isAvailable = true;
                for (const lang of langList) {
                    const langKey = locales[lang as keyof Locales][locId];
                    if (!langKey) {
                        isAvailable = false;
                        continue;
                    }

                    if (lang === "eng_us") charObj.name = toProperCase(langKey);
                    const out = {
                        id: locId,
                        language: lang,
                        langKey,
                    };
                    bulkEventLocPut.push({
                        updateOne: {
                            filter: { id: locId, language: lang },
                            update: { $set: out },
                            upsert: true,
                        },
                    });
                }
                // If locale strings were available, go ahead and stick the info in
                if (isAvailable) charArr.push(charObj);
            } else {
                // Run stuff through for hard nodes
                const outMode = campaignMapNames?.[node.campaignId]?.game_mode;
                if (!outMode) continue;

                // Hard nodes additionally key on difficulty + missionId; skip entries missing either
                if (!node.campaignNodeDifficulty || !node.campaignMissionId) continue;

                const outNode =
                    campaignMapNodes?.[node.campaignId]?.[node.campaignMapId]?.[node.campaignNodeDifficulty]?.[node.campaignNodeId]?.[
                        node.campaignMissionId
                    ];

                // ONLY /farm and /need use these
                const modeMap = {
                    "Light Side Battles": { suffix: " (L)", locId: "HARD_LIGHT" },
                    "Dark Side Battles": { suffix: " (D)", locId: "HARD_DARK" },
                    "Cantina Battles": { suffix: "", locId: "CANTINA" },
                    "Fleet Battles": { suffix: " (Fleet)", locId: "HARD_FLEET" },
                    default: { suffix: "N/A", locId: null },
                };
                const { suffix, locId } = modeMap[outMode as keyof typeof modeMap] || modeMap.default;

                let type = outMode === "Cantina Battles" ? "Cantina" : "Hard Modes";
                if (suffix.length) type += suffix;

                charArr.push({
                    type,
                    level: outNode,
                    locId,
                });
            }
        }

        // Process the shop locations/ costs
        for (const store of featureStoreList) {
            if (!store?.rewards?.units?.length) continue;

            const thisUnit = store.rewards.units.find((u: { baseId: string }) => u.baseId === mat.defId);
            if (!thisUnit?.purchaseList) continue;

            charArr.push({
                type: store.storeId ?? "",
                cost: thisUnit.purchaseList.map(({ cost, currency, quantity }) => `${cost} ${currency}/${quantity}`).join("\n"),
            });
        }

        outArr.push({ defId: mat.defId, locations: charArr });
    }

    if (bulkEventLocPut.length) {
        await cache.putMany(env.MONGODB_SWAPI_DB, "locations", bulkEventLocPut);
    }

    // Wipe out all previous locations so we can replace them later, but leave the shop info alone
    const whitelistTypeLocs = [
        "Achievements",
        "Assault Battle",
        "Challenges",
        "Epic Confrontation",
        "Fleet Event",
        "Hero's Journey",
        "Heroic Event",
        "Legacy Event",
        "Legendary Event",
        "Mythic Event",
        "Proving Grounds",
        "Raids",
        "Special Event",
        "Territory Battle",
    ];
    const finalOut: UnitLocation[] = [];
    const locationMap: Record<string, Location[]> = {};
    let hasChanges = false;

    // Build map of old locations for change detection
    const oldLocsMap = new Map(currentLocs.map((loc) => [loc.defId, loc]));

    // Filter locations and build a hash map for quick lookup
    for (const loc of currentLocs) {
        const filteredLocations = loc.locations.filter(
            (thisLoc) => thisLoc?.cost?.length || (whitelistTypeLocs.includes(thisLoc?.type) && !thisLoc.locId),
        );
        if (filteredLocations.length) {
            locationMap[loc.defId] = filteredLocations;
        }
    }

    // Merge location data and construct final output
    for (const unit of currentUnits) {
        const thisUnitLoc = locationMap[unit.uniqueName] || [];
        const unitLoc: { defId: string; locations?: Location[] } = outArr.find((loc) => loc.defId === unit.uniqueName) || {
            defId: unit.uniqueName,
        };

        const locations: Location[] = removeDuplicates([...thisUnitLoc, ...(unitLoc?.locations || [])]);
        const unitName = unit.name;

        if (!unitName) continue;

        const newUnitData = {
            name: unitName,
            defId: unitLoc.defId,
            locations: locations.sort((a, b) => (a.type?.toLowerCase() || "").localeCompare(b.type?.toLowerCase() || "")),
        };

        // Detect changes as we build the output
        if (!hasChanges) {
            const oldUnitData = oldLocsMap.get(unitLoc.defId);
            if (!oldUnitData) {
                // New unit added
                hasChanges = true;
            } else if (JSON.stringify(oldUnitData.locations) !== JSON.stringify(newUnitData.locations)) {
                // Locations changed for existing unit (count or content)
                hasChanges = true;
            }
        }

        finalOut.push(newUnitData);
    }

    // Sort the final output array
    const sortedOut = finalOut.sort((a, b) => {
        const nameA = a?.name?.toLowerCase() || "";
        const nameB = b?.name?.toLowerCase() || "";
        const nameComparison = nameA.localeCompare(nameB);
        if (nameComparison !== 0) return nameComparison;
        // Fallback to defId if names are equal
        return a.defId.toLowerCase().localeCompare(b.defId.toLowerCase());
    });

    // Final check: catch length changes and unit swaps (removed + added in same cycle)
    if (!hasChanges) {
        const newDefIds = new Set(sortedOut.map((u) => u.defId));
        if (sortedOut.length !== currentLocs.length || currentLocs.some((u) => !newDefIds.has(u.defId))) {
            hasChanges = true;
        }
    }

    return { locations: sortedOut, hasChanges };
}

function removeDuplicates(locations: Location[]) {
    const seen = new Set();
    return locations.filter((location) => {
        const key = `${location.type}_${location?.cost || location?.locId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// CG versions localization keys inconsistently and without warning: the same event name has
// shipped as `KEY`, `KEY_2`, `KEY_V2`, `KEY_V3` and even `KEYV2` (no separator). Hardcoding
// whichever suffix was current when a branch was written means a rename silently drops the
// location (see BUG_REFERENCE.md), so resolve the base key against the versions that actually
// exist and take the newest. Only the V forms are treated as versions -- a trailing `_<n>` is
// usually an ordinary index (`_01`, `_95`), so only the legacy `_2` that check1or2 used is kept.
// Versions observed in the wild top out at V7; the cap just bounds the probe.
const MAX_LOC_KEY_VERSION = 9;

function resolveLocKey(baseKey: string, locale: Record<string, string>): string | null {
    if (!locale) return null;
    for (let version = MAX_LOC_KEY_VERSION; version >= 2; version--) {
        for (const key of [`${baseKey}_V${version}`, `${baseKey}V${version}`]) {
            if (locale[key]) return key;
        }
    }
    if (locale[`${baseKey}_2`]) return `${baseKey}_2`;
    return locale[baseKey] ? baseKey : null;
}

async function getMostRecentGameData(comlinkStub: ComlinkStub, version: string): Promise<GameData> {
    const dataFile = `gameData_${version}.json`;
    const filePath = path.join(GAMEDATA_DIR_PATH, dataFile);

    // Try to read cached file
    try {
        const cachedData = (await readJSON(filePath)) as GameData;
        debugLog(`Found gameData for ${version}`);
        return cachedData;
    } catch (error) {
        // File doesn't exist or can't be read, fetch new data
        debugLog(`No cached gameData for ${version} (${fsErrInfo(error)}), fetching new copy`);
    }

    // If we don't have the most recent version locally, grab a new copy of the gameData from CG
    const gameData = (await withTimeout(comlinkStub.getGameData(version, false), 60000, "getGameData")) as GameData;

    // This is going to be a new version, so we can just delete the old files
    const allFiles = await readdir(GAMEDATA_DIR_PATH);
    const oldFiles = allFiles.filter((fileName) => fileName.startsWith("gameData_") && fileName !== dataFile);
    await Promise.all(
        oldFiles.map(async (f) => {
            try {
                await unlink(path.join(GAMEDATA_DIR_PATH, f));
            } catch (error) {
                // Ignore ENOENT (file already deleted), log other errors
                if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                    logger.warn(`[getMostRecentGameData] Failed to delete old file ${f}: ${error}`);
                }
            }
        }),
    );

    // Then save it
    await saveFile(filePath, gameData, false);

    // Then return the gameData
    return gameData;
}

// gameData with the keys validateGameData guarantees present, so downstream processors can
// consume them without re-checking for undefined.
type ValidatedGameData = GameData &
    Required<
        Pick<
            GameData,
            | "ability"
            | "skill"
            | "category"
            | "equipment"
            | "material"
            | "statMod"
            | "recipe"
            | "units"
            | "unitGuideDefinition"
            | "requirement"
            | "challenge"
        >
    >;

function validateGameData(gameData: GameData): asserts gameData is ValidatedGameData {
    const requiredKeys = [
        "ability",
        "skill",
        "category",
        "equipment",
        "material",
        "statMod",
        "recipe",
        "units",
        "unitGuideDefinition",
        "requirement",
        "challenge",
    ];

    const missingKeys = requiredKeys.filter((key) => !gameData[key as keyof GameData] || !Array.isArray(gameData[key as keyof GameData]));
    if (missingKeys.length > 0) {
        throw new Error(`[validateGameData] Missing or invalid gameData keys: ${missingKeys.join(", ")}`);
    }
    logger.log("[validateGameData] Validated gameData");
}

async function updateGameData(locales: Locales, metadata: Metadata, comlinkStub: ComlinkStub) {
    try {
        if (!metadata.latestGamedataVersion) {
            throw new Error("[updateGameData] Missing latestGamedataVersion from metadata");
        }

        debugLog("Running main updaters");

        const gameData = await getMostRecentGameData(comlinkStub, metadata.latestGamedataVersion);

        await processGameData(gameData, locales);
    } catch (error) {
        logError("dataUpdater/updateGameData", "Error processing game data:", error);
        throw error;
    }
}

async function processGameData(gameData: GameData, locales: Locales) {
    try {
        debugTime("Finished processing all GameData");
        logMem("processGameData start (gameData + locales held)");
        // Validate gameData structure before processing
        validateGameData(gameData);

        debugTime("Finished processing Abilities");
        const { abilitiesOut, skillMap } = processAbilities(gameData.ability, gameData.skill);
        await saveFile(path.join(DATA_DIR_PATH, "skillMap.json"), skillMap, false);
        await processLocalization(abilitiesOut, "abilities", ["nameKey", "descKey", "abilityTiers"], "id", locales);
        debugTimeEnd("Finished processing Abilities");
        logMem("after abilities localization");

        debugTime("Finished processing Omicrons");
        const omicrons = sortOmicrons(abilitiesOut, locales);
        await saveFile(path.join(DATA_DIR_PATH, "omicrons.json"), omicrons, false);
        debugTimeEnd("Finished processing Omicrons");

        debugTime("Finished processing Categories");
        const catMapOut = processCategories(gameData.category) as { id: string; descKey: string }[];
        // await saveFile(dataDir + "catMap.json", catMapOut, false);
        await processLocalization(catMapOut, "categories", ["descKey"], "id", locales);
        debugTimeEnd("Finished processing Categories");

        debugTime("Finished processing Equipment");
        const mappedEquipmentList = processEquipment(gameData.equipment);
        await processLocalization(mappedEquipmentList, "gear", ["nameKey"], "id", locales);
        debugTimeEnd("Finished processing Equipment");
        logMem("after gear localization");

        debugTime("Finished processing Materials");
        const { unitShardList, bulkMatArr } = processMaterials(gameData.material);
        await cache.putMany(env.MONGODB_SWAPI_DB, "materials", bulkMatArr);
        debugTimeEnd("Finished processing Materials");

        debugTime("Finished processing Mod data");
        const modsOut = processModData(gameData.statMod);
        await saveFile(path.join(DATA_DIR_PATH, "modMap.json"), modsOut, false);
        debugTimeEnd("Finished processing Mod data");

        debugTime("Finished processing Recipes");
        const { unitRecipeList, mappedRecipeList } = processRecipes(gameData.recipe);
        await processLocalization(mappedRecipeList, "recipes", ["descKey"], "id", locales, ["eng_us"]);
        debugTimeEnd("Finished processing Recipes");

        debugTime("Finished processing Units");
        const processedUnitList = processUnits(gameData.units);

        // Put all the baseId and english names together for later use with the crew
        const unitDefIdMap: Record<string, string> = {};
        for (const unit of processedUnitList) {
            unitDefIdMap[unit.baseId] = locales.eng_us[unit.nameKey];
        }

        const bulkUnitArr = unitsToCharacterDB(structuredClone(processedUnitList));
        await cache.putMany(env.MONGODB_SWAPI_DB, "characters", bulkUnitArr);
        await processLocalization(processedUnitList, "units", ["nameKey"], "baseId", locales);

        const unitsOut = unitsForUnitMapFile(processedUnitList);
        await saveFile(path.join(DATA_DIR_PATH, "unitMap.json"), unitsOut, false);

        // Update & save the character/ship.json files
        const [oldCharFile, oldShipFile] = await Promise.all([readJSON<BotUnit[]>(CHAR_FILE_PATH), readJSON<BotUnit[]>(SHIP_FILE_PATH)]);
        const { charactersOut, shipsOut } = unitsToUnitFiles(
            processedUnitList,
            locales,
            catMapOut,
            unitDefIdMap,
            unitRecipeList,
            unitShardList,
            oldCharFile,
            oldShipFile,
        );
        await saveFile(CHAR_FILE_PATH, sortByName(charactersOut));
        await saveFile(SHIP_FILE_PATH, sortByName(shipsOut));
        debugTimeEnd("Finished processing Units");
        logMem("after units processing");

        debugTime("Finished processing Journey Reqs");
        await processJourneyReqs(gameData);
        debugTimeEnd("Finished processing Journey Reqs");

        const raidNamesOut = await saveRaidNames(locales);
        await saveFile(RAID_NAMES_FILE_PATH, raidNamesOut);
        debugLog("Finished processing Raid Names");

        debugTime("Finished updating Unit Checklist");
        await updateUnitChecklist(charactersOut, shipsOut);
        debugTimeEnd("Finished updating Unit Checklist");

        debugTimeEnd("Finished processing all GameData");
    } catch (error) {
        logError("dataUpdater/processGameData", "Error processing game data chunks:", error);
        throw error;
    }
}

async function processLocalization(
    rawDataIn:
        | ComlinkAbility[]
        | RecipeMap[]
        | ProcessedUnit[]
        | {
              language?: string;
              [key: string]: string | string[] | Record<string, string> | undefined;
          }[],
    dbTarget: string,
    targetKeys: string[],
    dbIdKey: string,
    locales: Locales,
    langList: SWAPILang[] | null = null,
) {
    const idKey = dbIdKey || "id";
    const thisLangList: SWAPILang[] = langList || (Object.keys(locales) as SWAPILang[]);
    const bulkWriteArr: AnyBulkWriteOperation[] = [];

    for (const lang of thisLangList) {
        // For each language that we need to localize for...
        for (const data of rawDataIn) {
            // For each chunk of the dataIn (ability, gear, recipes, unit, etc)
            // Create new object instead of mutating - eliminates need for structuredClone
            const localizedData: Record<string, unknown> = { ...data, language: lang };
            const dataRec = data as Record<string, unknown>;

            for (const target of targetKeys) {
                // For each of the specified keys of each chunk
                const rawVal = dataRec[target];
                localizedData[target] = Array.isArray(rawVal)
                    ? rawVal.map((entry) => locales[lang][entry] || entry)
                    : locales[lang][rawVal as string] || rawVal;
            }
            bulkWriteArr.push({
                updateOne: {
                    filter: { [idKey]: localizedData[idKey], language: lang }, // Filter by the given key, and language
                    update: { $set: localizedData }, // Update with the localized data
                    upsert: true, // Insert if document doesn't exist
                },
            });
        }
        debugLog(`Finished localizing ${dbTarget} for ${lang}`);
    }

    // Batch operations to avoid overwhelming MongoDB
    const BATCH_SIZE = 1000;
    for (let i = 0; i < bulkWriteArr.length; i += BATCH_SIZE) {
        await cache.putMany(env.MONGODB_SWAPI_DB, dbTarget, bulkWriteArr.slice(i, i + BATCH_SIZE));
    }
    debugLog(`Finished localizing ${dbTarget}`);
}

async function saveRaidNames(locales: Locales) {
    const langList = Object.keys(locales);

    // Auto-discover raid keys from localization data
    // This allows the bot to automatically pick up new raids without manual updates
    const raidKeys: Record<string, string> = {};
    const discoveredRaids: string[] = [];

    // Known legacy mappings for special cases that don't follow standard patterns
    const legacyMappings: Record<string, string> = {
        RAID_AAT_NAME: "aat",
        RAID_RANCOR_NAME: "rancor",
        RAID_RANCOR_CHALLENGE_NAME: "rancor_challenge",
        RAID_TRIUMVIRATE_NAME: "sith_raid",
        MISSION_GUILDRAIDSLEGACY_HEROIC_NAME: "heroic",
    };

    // Load existing raidNames to compare and detect new raids
    let existingRaids: Set<string> = new Set();
    try {
        const existingRaidNames = await readJSON<Record<string, Record<string, string>>>(RAID_NAMES_FILE_PATH);
        if (existingRaidNames?.eng_us) {
            existingRaids = new Set(Object.keys(existingRaidNames.eng_us));
        }
    } catch {
        // File doesn't exist yet or can't be read - all raids will be "new"
    }

    // Search through English localization keys to find raid-related patterns
    const englishKeys = Object.keys(locales.eng_us || {});
    for (const key of englishKeys) {
        let raidId: string | null = null;

        // Check if this is a legacy mapping first
        if (legacyMappings[key]) {
            raidId = legacyMappings[key];
        }
        // Pattern: MISSION_GUILDRAIDS_*_NAME (e.g., MISSION_GUILDRAIDS_KRAYTDRAGON_NAME)
        // This is the primary pattern for current guild raids
        else if (key.startsWith("MISSION_GUILDRAIDS") && key.endsWith("_NAME") && !key.includes("GIFT") && !key.includes("PACK")) {
            const match = key.match(/^MISSION_GUILDRAIDS(?:LEGACY)?_([A-Z0-9]+)_NAME$/);
            if (match?.[1]) {
                // Exclude generic strings that aren't specific raid IDs
                const extracted = match[1];
                if (extracted !== "NAME" && extracted !== "HEROIC") {
                    raidId = extracted.toLowerCase();
                }
            }
        }

        // If we found a raid ID, add it to the mapping
        if (raidId) {
            raidKeys[key] = raidId;
            discoveredRaids.push(raidId);
        }
    }

    // Determine which raids are new by comparing with existing file
    const newRaids = discoveredRaids.filter((raid) => !existingRaids.has(raid));
    if (newRaids.length > 0) {
        logger.log(`[saveRaidNames] Discovered ${newRaids.length} new raid(s): ${newRaids.join(", ")}`);
    }

    logger.log(`[saveRaidNames] Found ${discoveredRaids.length} total raids: ${discoveredRaids.sort().join(", ")}`);

    // Build the output structure with all languages
    const raidNamesOut: Record<string, Record<string, string>> = {};
    for (const lang of langList) {
        raidNamesOut[lang] = {};
        for (const [key, value] of Object.entries(raidKeys)) {
            raidNamesOut[lang][value] = locales[lang as keyof Locales][key];
        }
    }
    return raidNamesOut;
}

function processAbilities(abilityIn: comlinkComponents["Ability"][], skillIn: comlinkComponents["SkillDefinition"][]) {
    const abilitiesOut = [] as ComlinkAbility[];
    const skillMap = {} as {
        [key: string]: {
            nameKey: string;
            isZeta: boolean;
            tiers: number;
            abilityId: string;
        };
    };

    // Build lookup map for O(1) access
    const skillsByAbilityRef = new Map(skillIn.map((skill) => [skill.abilityReference, skill]));

    // tierList: [
    //     'SKILLRECIPE_PASSIVE_T1',
    //     SKILLRECIPE_PASSIVE_T2',
    //     SKILLRECIPE_PASSIVE_T3',
    //     SKILLRECIPE_PASSIVE_T4',
    //     SKILLRECIPE_PASSIVE_T5',
    //     SKILLRECIPE_PASSIVE_T6',
    //     SKILLRECIPE_PASSIVE_T7_ZETA',
    //     SKILLRECIPE_PASSIVE_T8_OMICRON'
    // ]

    for (const ability of abilityIn) {
        const skill = skillsByAbilityRef.get(ability.id);
        if (!skill || !ability.id || !skill.id || !skill.tier) continue;

        const abTiers = ability.tier?.map((ti) => ti.descKey ?? "") || [];
        const tierList = skill.tier.map((t) => t.recipeId ?? "");
        let isZeta = false;
        let zetaTier: number | null = null;
        let omicronTier: number | null = null;
        let isOmicron = false;
        for (const [ix, tier] of tierList.entries()) {
            const mod = tier.split("_").slice(-1)[0];
            if (mod === "ZETA") {
                isZeta = true;
                zetaTier = ix + 1;
            }
            if (mod === "OMICRON") {
                isOmicron = true;
                omicronTier = ix + 1;
            }
        }

        abilitiesOut.push({
            id: ability.id,
            type: ability.abilityType as string,
            nameKey: ability.nameKey ?? "",
            descKey: abTiers.slice(-1)[0] || ability.descKey || "",
            cooldown: ability.cooldown ?? 0,
            abilityTiers: abTiers,
            skillId: skill.id,
            tierList,
            isZeta,
            zetaTier,
            isOmicron,
            omicronTier,
        });

        skillMap[skill.id] = {
            nameKey: ability.nameKey ?? "",
            isZeta,
            tiers: skill.tier.length,
            abilityId: skill.abilityReference ?? "",
        };
    }
    return { abilitiesOut, skillMap };
}

function sortOmicrons(abilitiesOut: ComlinkAbility[], locales: Locales): OmicronCategories {
    const omicronTypes: OmicronCategories = {
        tw: [],
        ga3: [],
        ga: [],
        tb: [],
        raid: [],
        conquest: [],
        other: [],
    };

    // Filter for omicron abilities only
    const omicronAbilities = abilitiesOut.filter((ab) => ab.isOmicron);

    for (const ab of omicronAbilities) {
        // Get English description text for categorization
        const descText = locales.eng_us[ab.descKey]?.toLowerCase() || "";

        const omicronData = {
            skillId: ab.skillId,
            descKey: ab.descKey,
        };

        // Categorize by checking description keywords
        // Check ga3 before ga to avoid false positives
        if (descText.includes("3v3 grand arenas")) {
            omicronTypes.ga3.push(omicronData);
        } else if (descText.includes("grand arenas")) {
            omicronTypes.ga.push(omicronData);
        } else if (descText.includes("territory war")) {
            omicronTypes.tw.push(omicronData);
        } else if (descText.includes("territory battle")) {
            omicronTypes.tb.push(omicronData);
        } else if (descText.includes("conquest")) {
            omicronTypes.conquest.push(omicronData);
        } else if (descText.includes("raid")) {
            omicronTypes.raid.push(omicronData);
        } else {
            omicronTypes.other.push(omicronData);
        }
    }

    return omicronTypes;
}

function processCategories(catsIn: comlinkComponents["Category"][]) {
    const catMapOut = catsIn.filter((cat) => cat.visible || cat.id?.startsWith("alignment")).map(({ id, descKey }) => ({ id, descKey }));
    return catMapOut;
}

function processEquipment(equipmentIn: comlinkComponents["EquipmentDef"][]) {
    const mappedEquipmentList = equipmentIn.map(({ id, nameKey, recipeId, mark }) => ({ id, nameKey, recipeId, mark }));
    return mappedEquipmentList;
}

function processMaterials(materialIn: components["schemas"]["CraftingMaterialDef"][]) {
    const unitShardList: { id: string; iconKey: string }[] = [];
    const bulkMatArr: AnyBulkWriteOperation[] = [];

    for (const mat of materialIn) {
        if (!mat.id?.startsWith("unitshard")) continue;
        unitShardList.push({
            id: mat.id,
            iconKey: (mat.iconKey ?? "").replace(/^tex\./, ""),
        });

        bulkMatArr.push({
            updateOne: {
                filter: { id: mat.id },
                update: {
                    $set: {
                        id: mat.id,
                        lookupMissionList: (mat.lookupMission ?? []).map((mis) => mis.missionIdentifier),
                        raidLookupList: (mat.raidLookup ?? []).map((mis) => mis.missionIdentifier),
                        iconKey: mat.iconKey ?? "",
                    },
                },
                upsert: true,
            },
        });
    }
    return { unitShardList, bulkMatArr };
}

function processModData(modsIn: comlinkComponents["StatModDefinition"][]) {
    // gameData.statMod  ->  This is used to get slot, set, and pip of each mod
    const modsOut: ModMap = {};
    for (const { id, rarity, setId, slot } of modsIn) {
        if (!id) continue;
        modsOut[id] = {
            pips: Number(rarity) || 0,
            set: setId ?? "",
            slot: Number(slot) || 0,
        };
    }
    return modsOut;
}

function processRecipes(recipeIn: comlinkComponents["Recipe"][]) {
    const mappedRecipeList = [] as RecipeMap[];
    const unitRecipeList: { id: string; unitShard: string }[] = [];

    for (const recipe of recipeIn) {
        const { id, descKey, ingredients } = recipe;
        const filteredIngredients = (ingredients ?? []).filter((ing) => ing.id !== "GRIND");

        // Add recipe to mappedRecipeList
        mappedRecipeList.push({
            id: id ?? "",
            descKey: descKey ?? "",
            ingredients: filteredIngredients,
        });

        // Add unitshard information to unitRecipeList
        const unitShardList = filteredIngredients.filter((ing) => ing.id?.startsWith("unitshard"));
        if (unitShardList.length) {
            unitRecipeList.push({
                id: id ?? "",
                unitShard: unitShardList[0].id ?? "",
            });
        }
    }

    return { unitRecipeList, mappedRecipeList };
}

function processUnits(unitsIn: comlinkComponents["UnitDef"][]): ProcessedUnit[] {
    return unitsIn
        .filter((unit) => {
            if (unit.rarity !== 7 || !unit.obtainable || Number(unit.obtainableTime as unknown) !== 0) return false;
            return true;
        })
        .map((unit) => {
            return {
                baseId: unit.baseId ?? "", // uniqueName
                nameKey: unit.nameKey ?? "", // name
                skillReferenceList: unit.skillReference ?? [],
                categoryIdList: unit.categoryId ?? [],
                combatType: unit.combatType ?? CHAR_COMBAT_TYPE,
                unitTierList:
                    unit.unitTier?.map((tier) => {
                        return {
                            tier: tier.tier,
                            equipmentSetList: tier.equipmentSet ?? [],
                        };
                    }) ?? [],
                crewList: unit.crew ?? [],
                creationRecipeReference: unit.creationRecipeReference ?? "",
                legend: unit?.legend ?? false, // True if GL?
            };
        });
}

function unitsToUnitFiles(
    filteredList: ProcessedUnit[],
    locales: Locales,
    catMap: { id: string; descKey: string }[],
    unitDefIdMap: Record<string, string>,
    unitRecipeList: { id: string; unitShard: string }[],
    unitShardList: { id: string; iconKey: string }[],
    oldCharFile: BotUnit[],
    oldShipFile: BotUnit[],
) {
    const engStringMap = locales.eng_us;

    // Build lookup maps for O(1) access
    const recipeMap = new Map(unitRecipeList.map((r) => [r.id, r.unitShard]));
    const shardMap = new Map(unitShardList.map((s) => [s.id, s.iconKey]));

    const charactersOut: BotUnit[] = [];
    const shipsOut: BotUnit[] = [];

    for (const unit of filteredList) {
        const oldFile = unit.combatType === CHAR_COMBAT_TYPE ? oldCharFile : oldShipFile;
        const oldUnit = oldFile.find((u) => u.uniqueName === unit.baseId);
        const charUIName = getCharUIName(unit.creationRecipeReference, recipeMap, shardMap) ?? "";
        const name = engStringMap?.[unit.nameKey] || unit.nameKey;

        const unitFactionsObj = catMap.filter((cat) => unit.categoryIdList.includes(cat.id));
        const { factions, side } = getSide(unitFactionsObj);

        // catMap holds raw descKeys; processLocalization only ever writes localized copies to the
        // db, so the display names these files (and the `factions` constant built from them) need
        // have to be resolved here.
        const localizedFactions = factions.map((faction) => engStringMap?.[faction] || faction);

        // crew is ship-only, so it's dropped here rather than carried over: earlier runs wrote an
        // empty one onto every character, where it means nothing.
        const isShip = unit.combatType === SHIP_COMBAT_TYPE;
        const { crew: _oldCrew, ...oldUnitFields } = oldUnit ?? {};

        // Everything assigned here is derived from game data, so it is recomputed every run --
        // fields that are curated (aliases) or filled in by other passes (mods, abilities, url)
        // are carried over from the existing entry instead.
        const unitObj: BotUnit = {
            ...oldUnitFields,
            name,
            uniqueName: unit.baseId,
            aliases: oldUnit?.aliases?.length ? oldUnit.aliases : [name],
            avatarName: charUIName,
            avatarURL: `https://game-assets.swgoh.gg/textures/tex.${charUIName}.png`,
            side,
            factions: localizedFactions.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
            mods: unit.combatType === CHAR_COMBAT_TYPE ? (oldUnit?.mods ?? ({} as BotUnitMods)) : null,
            ...(isShip ? { crew: unit.crewList?.map((cr) => unitDefIdMap[cr.unitId ?? ""]) ?? [] } : {}),
        };

        if (unit.combatType === CHAR_COMBAT_TYPE) {
            charactersOut.push(unitObj);
        } else if (unit.combatType === SHIP_COMBAT_TYPE) {
            shipsOut.push(unitObj);
        } else {
            logger.error({ message: "Bad combatType for", unit: unitObj });
        }
    }

    return { charactersOut, shipsOut };
}

function getCharUIName(creationRecipeId: string, recipeMap: Map<string, string>, shardMap: Map<string, string>) {
    const unitShard = recipeMap.get(creationRecipeId);
    return unitShard ? shardMap.get(unitShard) : undefined;
}

function getSide(factions: { id: string; descKey: string }[]): { side: UnitSide; factions: string[] } {
    for (const side of ["dark", "light", "neutral"]) {
        const found = factions.find((fact) => fact.id === `alignment_${side}`);
        if (found) {
            const filteredFactions = factions.filter((fact) => fact !== found);
            return {
                side: side as UnitSide,
                factions: filteredFactions.map((fact) => fact.descKey),
            };
        }
    }
    // Fallback for units without alignment - shouldn't happen but prevents undefined
    logger.warn("Unit has no alignment faction, defaulting to neutral");
    return {
        side: "neutral" as UnitSide,
        factions: factions.map((fact) => fact.descKey),
    };
}

function sortByName(list: { name: string }[]) {
    return list.sort((a, b) => (a.name?.toLowerCase() || "").localeCompare(b.name?.toLowerCase() || ""));
}

// Storage variant of ProcessedUnit: this function strips the fields that aren't persisted to the
// characters table (nameKey/categoryIdList/crewList/creationRecipeReference), so they're optional here.
type CharacterDBUnit = Omit<ProcessedUnit, "nameKey" | "categoryIdList" | "crewList" | "creationRecipeReference"> & {
    nameKey?: string;
    categoryIdList?: string[];
    crewList?: ProcessedUnit["crewList"];
    creationRecipeReference?: string;
};

function unitsToCharacterDB(unitsIn: CharacterDBUnit[]) {
    const catList = new Set(["alignment", "profession", "affiliation", "role", "shipclass"]);
    const ignoreSet = new Set([
        "fomilitary",
        "galactic",
        "order66",
        "sithlord",
        "palp",
        "rebfalconcrew",
        "smuggled",
        "foexecutionsquad",
        "gacs2fireteam",
        "jacket",
        "el16",
        "ptisfalconcrew",
        "forcelightning",
        "doubleblade",
        "kenobi",
        "translator",
        "rey",
        "veteransmuggler",
        "crimsondawn",
        "sabacc",
        "dathbro",
        "prisfalconcrew",
        "kylo",
        "capital",
        "resistancexwing",
        "fotie",
        "millennium",
    ]);
    const factionMap = {
        badbatch: "bad batch",
        bountyhunter: "bounty hunter",
        capitalship: "capital ship",
        cargoship: "cargo ship",
        clonetrooper: "clone trooper",
        dark: "dark side",
        firstorder: "first order",
        huttcartel: "hutt cartel",
        imperialremnant: "imperial remnant",
        imperialtrooper: "imperial trooper",
        inquisitoriu: "inquisitorius",
        light: "light side",
        oldrepublic: "old republic",
        rebelfighter: "rebel fighter",
        republic: "galactic republic",
        rogue: "rogue one",
        sithempire: "sith empire",
    };

    const bulkLocPut: AnyBulkWriteOperation[] = [];

    // Process the units list to go into the characters db table
    for (const unit of unitsIn) {
        const factions: Set<string> = new Set();
        const crewIds: string[] = [];
        const skillReferences = unit.skillReferenceList || [];

        unit.nameKey = undefined;
        unit.creationRecipeReference = undefined;

        if (!unit.categoryIdList) {
            logger.error(`Missing baseCharacter abilities for ${unit.baseId}`);
            continue;
        }
        for (const category of unit.categoryIdList) {
            const [prefix, faction] = category.split("_");
            if (catList.has(prefix) && !ignoreSet.has(faction)) {
                factions.add(toProperCase(factionMap[faction as keyof typeof factionMap] || faction));
            }
        }

        unit.factions = Array.from(factions);
        unit.categoryIdList = undefined;

        if (unit.crewList?.length) {
            for (const crewChar of unit.crewList) {
                crewIds.push(crewChar.unitId ?? "");
                skillReferences.push(...(crewChar.skillReference ?? []));
            }
        }

        unit.crewList = undefined;
        unit.crew = crewIds;
        unit.skillReferenceList = skillReferences;

        bulkLocPut.push({
            updateOne: {
                filter: { baseId: unit.baseId },
                update: {
                    $set: unit,
                },
                upsert: true,
            },
        });
    }
    return bulkLocPut;
}

function unitsForUnitMapFile(unitsIn: ProcessedUnit[]) {
    // gameData.units -> This is used to grab nameKey (Yes, we actually need it), crew data & combatType
    const unitsOut = unitsIn.reduce<Record<string, unknown>>((acc, unit) => {
        acc[unit.baseId] = {
            nameKey: unit.nameKey,
            combatType: unit.combatType,
            crew:
                unit.crewList?.map((cr) => ({
                    skillReferenceList: cr.skillReference,
                    unitId: cr.unitId,
                    slot: cr.slot,
                })) || [],
        };
        return acc;
    }, {});

    return unitsOut;
}

async function getLocalizationData(comlinkStub: ComlinkStub, bundleVersion: string): Promise<Locales> {
    const IGNORE_KEYS = ["key_mapping", "datacron", "anniversary", "promo", "subscription"];
    const dataFile = `localizationBundle_${bundleVersion}.json`;
    const filePath = path.join(GAMEDATA_DIR_PATH, dataFile);

    // Try to read cached file
    try {
        const localeData = await readJSON<Locales>(filePath);
        debugLog(`Found localeData for ${bundleVersion}`);
        return localeData;
    } catch (error) {
        // File doesn't exist or can't be read, fetch new data
        debugLog(`No cached localeData for ${bundleVersion} (${fsErrInfo(error)}), fetching new copy`);
    }

    try {
        // If we don't have the most recent version locally, grab a new copy of the gameData from CG
        const localeData = (await withTimeout(
            comlinkStub.getLocalizationBundle(bundleVersion, true),
            60000,
            "getLocalizationBundle",
        )) as Record<string, string>;

        const localeOut = {} as Locales;
        for (const [lang, content] of Object.entries(localeData)) {
            const out: Record<string, string> = {};
            if (lang === "Loc_Key_Mapping.txt") continue;
            const langKey = lang.replace(/^Loc_|\.txt$/gi, "").toLowerCase();
            if (!content) {
                logger.warn(`[getLocalizationData] No content for ${langKey}`);
                continue;
            }

            for (const row of content.split("\n")) {
                if (IGNORE_KEYS.some((ign) => row.toLowerCase().includes(ign))) continue;
                const res = processLocalizationLine(row);
                if (res) {
                    const [key, val] = res;
                    if (key && val) out[key] = val;
                }
            }
            localeOut[langKey as keyof Locales] = out;
        }
        // This is going to be a new version, so we can just delete the old files
        const allDataFiles = await readdir(GAMEDATA_DIR_PATH);
        const dataFiles = allDataFiles.filter((fileName) => fileName.startsWith("localizationBundle_") && fileName !== dataFile);
        await Promise.all(
            dataFiles.map(async (f) => {
                try {
                    await unlink(path.join(GAMEDATA_DIR_PATH, f));
                } catch (error) {
                    // Ignore ENOENT (file already deleted), log other errors
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                        logger.warn(`[getLocalizationData] Failed to delete old file ${f}: ${error}`);
                    }
                }
            }),
        );

        // Then save it
        logger.log(`Saving localeData for ${bundleVersion}`);
        await saveFile(filePath, localeOut, false);

        // Then finally, return it
        return localeOut;
    } catch (error) {
        logError("dataUpdater/getLocalizationData", "Error fetching or processing localization data:", error);
        throw error; // Rethrow the error for further handling
    }
}

function processLocalizationLine(line: string) {
    if (line.startsWith("#")) return;
    let [key, val] = line.split(/\|/g).map((s) => s.trim());
    if (!key || !val) return;
    val = val
        .replace(/^\[[0-9A-F]*?\](.*)\s+\(([A-Z]+)\)\[-\]$/, (_, p1) => p1)
        .replace(/\\n/g, " ")
        .replace(/(\[\/?c*-*\]|\[[\w\d]{6}\])/g, "");
    return [key, val];
}

async function processJourneyReqs(gameData: ValidatedGameData) {
    const characters = await readJSON<BotUnit[]>(CHAR_FILE_PATH);
    const ships = await readJSON<BotUnit[]>(SHIP_FILE_PATH);
    let oldReqs = {} as JourneyReqs;
    // Grab the existing saved data if available
    try {
        oldReqs = await readJSON<JourneyReqs>(JOURNEY_FILE_PATH);
    } catch (error) {
        // File doesn't exist yet, will be created
        debugLog(`No existing journey requirements file (${fsErrInfo(error)}), creating new one`);
    }

    // Build lookup maps for O(1) access
    const requirementMap = new Map(gameData.requirement.map((req) => [req.id, req]));
    const challengeMap = new Map(gameData.challenge.map((chal) => [chal.id, chal]));
    const shipDefIds = new Set(ships.map((sh) => sh.uniqueName));

    // Grab all the units that have activation requirements to process
    const unitGuides = gameData.unitGuideDefinition
        .filter((g) => g.additionalActivationRequirementId)
        .map((g) => ({
            defId: g.unitBaseId,
            guideId: g.additionalActivationRequirementId,
        }));

    // For each character in the guide that had useful data, process their requirements
    const unitGuideOut: JourneyReqs = {};
    for (const unit of unitGuides) {
        const tempOut: JourneyReqs[string] = {
            guideId: unit.guideId ?? "",
            type: "AUTO",
            reqs: [],
        };

        // For each required character, save the defId, the required stat, and it's level
        const reqs = requirementMap.get(unit.guideId)?.requirementItem;
        if (!reqs) continue;

        for (const req of reqs) {
            const evs = challengeMap.get(req.id)?.task;
            if (!evs) continue;

            for (const ev of evs) {
                const splitDesc = (ev.descKey ?? "").split("_");
                const tier = Number.parseInt(splitDesc.pop() ?? "", 10);
                const type = splitDesc.pop() ?? "";
                const defId = ev?.actionLinkDef?.link?.split("=").pop();
                if (defId) {
                    if (shipDefIds.has(defId)) {
                        tempOut.reqs.push({ defId, type, tier, ship: true });
                    } else {
                        tempOut.reqs.push({ defId, type, tier });
                    }
                }
            }
        }

        // If it's found requirements for this unit, go ahead and keep em
        if (tempOut.reqs?.length && unit.defId) {
            unitGuideOut[unit.defId] = tempOut;
        }
    }

    // Process the old reqs data to keep any manual entries, and wipe out/ replace any automated ones
    const reqsOut: JourneyReqs = {};
    if (oldReqs && Object.keys(oldReqs).length) {
        for (const reqKey of Object.keys(oldReqs)) {
            const thisReq = oldReqs[reqKey];
            if (thisReq.type === "MIXED") {
                // Grab all the manually put in units
                const thisReqOut = thisReq.reqs.filter((unit) => unit.manual);
                const currentUnits = thisReqOut.map((unit) => unit.defId);

                // Go through each chunk from the auto section and get the units together
                for (const autoReq of thisReq.auto ?? []) {
                    const searchArr = autoReq.ship ? ships : characters;
                    const out = searchArr
                        .filter((unit) => {
                            // Don't keep units that're already in the list manually
                            if (currentUnits.includes(unit.uniqueName)) return false;

                            // Don't list the character you're trying to unlock as a valid requirement
                            if (unit.uniqueName === reqKey) return false;

                            // If it needs capital ships only, filter the list down to that
                            if (autoReq.capital) {
                                // If we want all capital ships, don't filter it down
                                if (autoReq.faction === "ALL") {
                                    return true;
                                }
                                return unit.factions.includes("Capital Ship");
                            }

                            // If it gets here, just check the required faction against the unit's factions list
                            return unit.factions.includes(autoReq.faction);
                        })
                        .map((unit) => {
                            const out: { defId: string; type: string; tier: number; ship?: boolean } = {
                                defId: unit.uniqueName,
                                type: autoReq.type,
                                tier: autoReq.tier,
                            };
                            if (autoReq?.ship) out.ship = true;
                            return out;
                        });
                    thisReqOut.push(...out);
                }
                thisReq.reqs = thisReqOut;
            }
            // Process and enter the characters for requirements that're just full factions
            // - This will make it so as new characters are added to a faction, they're included as needed
            if (thisReq.type === "FACTION" && thisReq.faction) {
                const faction = thisReq.faction;
                thisReq.reqs = characters
                    .filter((ch) => ch.factions.includes(faction.name))
                    .map((ch) => {
                        return {
                            defId: ch.uniqueName,
                            type: faction.type,
                            tier: faction.tier,
                        };
                    });
            }
            // Wipe out any auto entries, so they'll be reformed
            if (thisReq.type !== "AUTO") {
                reqsOut[reqKey] = thisReq;
            }
        }
    }

    debugLog(
        `Updating JourneyReqs file, ${Object.keys(oldReqs).length} manual entries, ${Object.keys(unitGuideOut).length} automatic entries`,
    );

    // Combine the old stuff with the new automated data
    await saveFile(JOURNEY_FILE_PATH, { ...reqsOut, ...unitGuideOut });
}

async function updateUnitChecklist(characters: BotUnit[], ships: BotUnit[]) {
    try {
        // Read current checklist
        let checklist: Record<string, [string, string][]>;
        try {
            checklist = await readJSON<Record<string, [string, string][]>>(UNIT_CHECKLIST_FILE_PATH);
        } catch (error) {
            logger.warn(`[updateUnitChecklist] Could not read checklist (${fsErrInfo(error)}), creating new one`);
            checklist = {
                "Galactic Legends": [],
                "Light Side": [],
                "Dark Side": [],
                "Capital Ships": [],
            };
        }

        // Build sets of existing unit IDs for quick lookup
        const existingGLs = new Set(checklist["Galactic Legends"]?.map((u) => u[0]) || []);
        const existingCapitalShips = new Set(checklist["Capital Ships"]?.map((u) => u[0]) || []);

        let hasChanges = false;

        // Find new Galactic Legends
        const newGLs = characters.filter((char) => char.factions?.includes("Galactic Legend") && !existingGLs.has(char.uniqueName));

        if (newGLs.length > 0) {
            for (const gl of newGLs) {
                // Create a shortened name (use first word or abbreviation)
                const shortName = gl.name || gl.uniqueName;
                checklist["Galactic Legends"].push([gl.uniqueName, shortName]);
                logger.log(`[updateUnitChecklist] Added new Galactic Legend: ${gl.name} (${gl.uniqueName})`);
                hasChanges = true;
            }

            // Sort Galactic Legends alphabetically by short name
            checklist["Galactic Legends"].sort((a, b) => a[1].toLowerCase().localeCompare(b[1].toLowerCase()));
        }

        // Find new Capital Ships
        const newCapitalShips = ships.filter(
            (ship) =>
                ship.factions?.includes("Capital Ship") &&
                ship.uniqueName.startsWith("CAPITAL") &&
                !existingCapitalShips.has(ship.uniqueName),
        );

        if (newCapitalShips.length > 0) {
            for (const ship of newCapitalShips) {
                // Use the ship name without "Capital Ship" prefix if present
                const shortName = ship.name.replace(/^Capital\s+/i, "").trim() || ship.uniqueName.replace(/^CAPITAL/, "");
                checklist["Capital Ships"].push([ship.uniqueName, shortName]);
                logger.log(`[updateUnitChecklist] Added new Capital Ship: ${ship.name} (${ship.uniqueName})`);
                hasChanges = true;
            }

            // Sort Capital Ships alphabetically by short name
            checklist["Capital Ships"].sort((a, b) => a[1].toLowerCase().localeCompare(b[1].toLowerCase()));
        }

        // Save if changes were made
        if (hasChanges) {
            await saveFile(UNIT_CHECKLIST_FILE_PATH, checklist);
            logger.log(
                `[updateUnitChecklist] Updated unit checklist with ${newGLs.length} new GL(s) and ${newCapitalShips.length} new Capital Ship(s)`,
            );
        } else {
            debugLog("[updateUnitChecklist] No new Galactic Legends or Capital Ships detected");
        }
    } catch (error) {
        logError("dataUpdater/updateUnitChecklist", "Error updating unit checklist:", error);
        // Don't throw - this shouldn't block the rest of the update process
    }
}

function debugTime(name: string) {
    if (!DEBUG_LOGS) return;
    if (!name?.length) return;
    console.time(name);
}
function debugTimeEnd(name: string) {
    if (!DEBUG_LOGS) return;
    if (!name?.length) return;
    console.timeEnd(name);
}

// Diagnostic: log a memory snapshot at a phase boundary. rss is process-wide (includes worker
// threads); heapUsed is the main isolate's JS objects; external/arrayBuffers covers Buffers and
// off-heap data. rss >> heapUsed points at worker payloads or buffers; high heapUsed points at
// main-thread JS (e.g. gameData/localization). Gated behind --debug like the other debug helpers.
function logMem(label: string) {
    if (!DEBUG_LOGS) return;
    const m = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);
    logger.log(
        `[mem] ${label}: rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB external=${mb(m.external)}MB arrayBuffers=${mb(m.arrayBuffers)}MB`,
    );
}

// Print CLI usage. Defaults shown here must track the numericArg() fallbacks above.
function printHelp() {
    const defaultThreads = Math.max(1, Math.min(availableParallelism(), MOD_FETCH_CONCURRENCY_CAP));
    console.log(`SWGoHBot data updater

Usage: node --env-file=.env services/dataUpdater.ts [options]

Runs a single update cycle then exits: checks game metadata, refreshes game data when the
version changed, recalculates mod stats from the top guilds, and exports command docs.

Options:
  -h, --help            Show this help and exit.
  --debug               Verbose timing, debug logging, and per-phase memory ([mem]) snapshots.
  --force-gamedata      Run the game data updaters even if the metadata is unchanged. Needed to
                        re-derive data/characters.json and data/ships.json on demand, since that
                        path is normally skipped when the version has not moved.
  --skip-mods           Skip the mod updaters. They fetch every player in the top 100 guilds and
                        dominate the cycle's runtime; nothing else depends on them.
  --cleanup             Run the database cleanup (deletes old player stats, guilds and empty
                        rosters). Off by default so a manual run never destroys data; the
                        scheduled run passes it via dataUpdater.config.cjs.
  --max-concurrent N    Max in-flight player fetches queued to the worker pool (default 80).
  --mod-threads N       Player-fetch worker threads (default min(cpuCount, ${MOD_FETCH_CONCURRENCY_CAP}); here ${defaultThreads}).
  --mod-tasks N         Concurrent tasks per worker thread (default 1).
  --worker-heap N       Per-worker V8 old-space cap in MB; bounds peak rss (default 256).`);
}

function debugLog(str: string | string[]) {
    if (!DEBUG_LOGS) return;
    if (typeof str === "string" && str.length) {
        logger.log(str);
    } else {
        logger.log(inspect(str, { depth: 5 }));
    }
}

function logError(context: string, message: string, error?: unknown) {
    logger.error(`[${context}] ${message}${error ? `: ${error}` : ""}`);
}

// fs/errno errors carry a `.code` (e.g. ENOENT) that's more useful than the message for logging.
function fsErrInfo(error: unknown): string {
    if (error instanceof Error) return (error as NodeJS.ErrnoException).code || error.message;
    return String(error);
}

function getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        Admin: "Commands with limited access",
        Gamedata: "Commands that pull data from the game",
        General: "General commands",
        Patreon: "Supporter-only commands",
    };
    return descriptions[category] || "Miscellaneous commands";
}

/**
 * Generate usage strings from command options
 * Handles subcommand groups, subcommands, and regular options
 */
function generateUsageFromOptions(commandName: string, options: unknown[]): string[] {
    if (!Array.isArray(options) || options.length === 0) {
        return [`**/${commandName}**`];
    }

    const usageStrings: string[] = [];

    // Helper to format a single option parameter
    const formatOption = (opt: { name: string; required?: boolean }) => {
        return opt.required ? `<${opt.name}>` : `[${opt.name}]`;
    };

    // Helper to build usage string for a set of options
    const buildUsageString = (baseCommand: string, opts: unknown[]) => {
        if (!Array.isArray(opts) || opts.length === 0) {
            return baseCommand;
        }

        const params = opts
            .filter((opt): opt is { name: string; type: number; required?: boolean } => {
                if (typeof opt !== "object" || opt === null) return false;
                const o = opt as { type?: number };
                // Exclude subcommand types from parameters
                return o.type !== ApplicationCommandOptionType.Subcommand && o.type !== ApplicationCommandOptionType.SubcommandGroup;
            })
            .map(formatOption)
            .join(" ");

        return params ? `${baseCommand} ${params}` : baseCommand;
    };

    for (const option of options) {
        if (typeof option !== "object" || option === null) continue;

        const opt = option as {
            name: string;
            type: number;
            options?: unknown[];
        };

        if (opt.type === ApplicationCommandOptionType.SubcommandGroup) {
            // Handle subcommand groups: /command group subcommand [options]
            const groupName = opt.name;
            if (Array.isArray(opt.options)) {
                for (const subOption of opt.options) {
                    if (typeof subOption !== "object" || subOption === null) continue;

                    const subOpt = subOption as {
                        name: string;
                        type: number;
                        options?: unknown[];
                    };

                    if (subOpt.type === ApplicationCommandOptionType.Subcommand) {
                        const baseCmd = `**/${commandName}** ${groupName} ${subOpt.name}`;
                        usageStrings.push(buildUsageString(baseCmd, subOpt.options || []));
                    }
                }
            }
        } else if (opt.type === ApplicationCommandOptionType.Subcommand) {
            // Handle subcommands: /command subcommand [options]
            const baseCmd = `**/${commandName}** ${opt.name}`;
            usageStrings.push(buildUsageString(baseCmd, opt.options || []));
        }
    }

    // If no subcommands/groups were found, generate a simple usage string
    if (usageStrings.length === 0) {
        usageStrings.push(buildUsageString(`**/${commandName}**`, options));
    }

    return usageStrings;
}

interface CommandDocEntry {
    name: string;
    description: string;
    usage: string[];
    options: unknown[];
    permLevel: number;
    devServerOnly: boolean;
    contexts: unknown;
    enabled: boolean;
}

async function exportCommandDocs() {
    try {
        logger.log("[exportCommandDocs] Starting command documentation export");

        // Load commands directly from slash directory since slashHandler may not be initialized
        const slashDir = path.join(import.meta.dirname, "..", "slash");
        const commandFiles = (await readdir(slashDir)).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

        const categoryMap: Record<string, { description: string; commands: CommandDocEntry[] }> = {};
        let totalCommands = 0;

        // Load and process each command file
        for (const file of commandFiles) {
            const commandName = file.replace(/\.ts$/, "");
            try {
                const commandPath = path.join(slashDir, file);
                const { default: CommandClass } = await import(commandPath);
                const cmd = new CommandClass();

                if (!cmd.commandData.enabled) {
                    debugLog(`[exportCommandDocs] Skipping disabled command: ${commandName}`);
                    continue;
                }

                const category = cmd.commandData.category || "General";

                if (!categoryMap[category]) {
                    categoryMap[category] = {
                        description: getCategoryDescription(category),
                        commands: [],
                    };
                }

                categoryMap[category].commands.push({
                    name: cmd.commandData.name,
                    description: cmd.commandData.description,
                    usage: generateUsageFromOptions(cmd.commandData.name, cmd.commandData.options),
                    options: cmd.commandData.options,
                    permLevel: cmd.commandData.permLevel,
                    devServerOnly: cmd.commandData.devServerOnly,
                    contexts: cmd.commandData.contexts,
                    enabled: cmd.commandData.enabled,
                });

                totalCommands++;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error(`[exportCommandDocs] Failed to load command ${commandName}: ${errorMessage}`);
                // Continue processing other commands
            }
        }

        // Sort commands within each category alphabetically
        for (const category of Object.keys(categoryMap)) {
            categoryMap[category].commands.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }

        const output: HelpJSON = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalCommands,
                categories: Object.keys(categoryMap).length,
            },
            ...categoryMap,
        };

        await saveFile(HELP_JSON_PATH, output);

        logger.log(`[exportCommandDocs] Exported ${totalCommands} commands across ${Object.keys(categoryMap).length} categories`);
    } catch (error) {
        logError("dataUpdater/exportCommandDocs", "Error exporting command docs", error);
        // Don't throw - this shouldn't block other updates
    }
}

export default {
    foldUnitMods,
    processAbilities,
    processCategories,
    processEquipment,
    processMaterials,
    processModData,
    processRecipes,
    processUnits,
    unitsToCharacterDB,
    unitsForUnitMapFile,
    unitsToUnitFiles,
    resolveLocKey,

    processModResults,

    processJourneyReqs,
    saveRaidNames,

    saveFile,
    processLocalization,
    exportCommandDocs,
};
