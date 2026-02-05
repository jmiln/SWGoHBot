import { readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { inspect } from "node:util";
import { eachLimit } from "async";
import { MongoClient } from "mongodb";
import { FixedQueue, Piscina } from "piscina";
import config from "../config.js";
import cache from "../modules/cache.ts";
import { readJSON } from "../modules/functions.ts";

// Grab the functions used for checking guilds' supporter arrays against Patreon supporters' info
import { clearSupporterInfo, ensureBonusServerSet, ensureGuildSupporter } from "../modules/guildConfig/patreonSettings.ts";

const FORCE_UPDATE = process.argv.includes("--force") || false;
const DEBUG_LOGS = process.argv.includes("--debug") || false;

// Maximum concurrent API requests to prevent rate limiting and excessive memory usage.
// Up to 120 seems to work ok, and cuts off 6 or so seconds of processing time, but it's just
// not worth the risk of rate limits.
const MAX_CONCURRENT = process.argv.includes("--max-concurrent")
    ? Number.parseInt(process.argv[process.argv.indexOf("--max-concurrent") + 1], 10)
    : 80;

import ComlinkStub from "@swgoh-utils/comlink";
import type { BotCache } from "../types/cache_types.ts";
import type { components, operations } from "../types/comlinkGamedata.js";
import type { ComlinkAbility, FeatureStore, SWAPILang, SWAPIUnit } from "../types/swapi_types.ts";
import type {
    BotUnit,
    BotUnitMods,
    JourneyReqs,
    Location,
    PatreonMember,
    PatreonUser,
    UnitLocation,
    UnitSide,
    UserConfig,
} from "../types/types.ts";

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

// Simplified call for auto-generated types from comlink openapi.yaml
type GameData = operations["getGameData"]["responses"]["2XX"]["content"]["application/json"];
type getGuildLeaderboardResponse = operations["getGuildLeaderboard"]["responses"]["2XX"]["content"]["application/json"];
type getGuildResponse = operations["getGuild"]["responses"]["2XX"]["content"]["application/json"];
type comlinkComponents = components["schemas"];

const CHAR_COMBAT_TYPE = 1;
const SHIP_COMBAT_TYPE = 2;

const DATA_DIR_PATH = path.resolve(import.meta.dirname, "../data/");
const GAMEDATA_DIR_PATH = path.resolve(import.meta.dirname, "../data/gameDataFiles/");
// const CACHE_FILE_PATH          = path.resolve(import.meta.dirname, "../modules/cache.js");

const CHAR_FILE_PATH = path.join(DATA_DIR_PATH, "characters.json");
const CHAR_LOCATIONS_FILE_PATH = path.join(DATA_DIR_PATH, "charLocations.json");
const JOURNEY_FILE_PATH = path.join(DATA_DIR_PATH, "journeyReqs.json");
const RAID_NAMES_FILE_PATH = path.join(DATA_DIR_PATH, "raidNames.json");
const SHIP_FILE_PATH = path.join(DATA_DIR_PATH, "ships.json");
const SHIP_LOCATIONS_FILE_PATH = path.join(DATA_DIR_PATH, "shipLocations.json");

// The metadata keys we actually care about
const META_KEYS = ["assetVersion", "latestGamedataVersion", "latestLocalizationBundleVersion"];

// Track resources for cleanup
let mongoClient: MongoClient | null = null;
let updatersTimeout: NodeJS.Timeout | null = null;
let patronsInterval: NodeJS.Timeout | null = null;

console.log("Starting data updater");

// Centralized cleanup function
async function cleanup() {
    console.log("Cleaning up resources...");

    // Clear timers
    if (updatersTimeout) {
        clearTimeout(updatersTimeout);
        updatersTimeout = null;
    }
    if (patronsInterval) {
        clearInterval(patronsInterval);
        patronsInterval = null;
    }

    // Close MongoDB connection
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
    }

    console.log("Cleanup complete");
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
        console.log("Received SIGINT, shutting down gracefully...");
        await cleanup();
        console.log("Exiting.");
        process.exit(0);
    });

    // Handle SIGTERM (common in Docker/cloud environments)
    process.on("SIGTERM", async () => {
        console.log("Received SIGTERM, shutting down gracefully...");
        await cleanup();
        console.log("Exiting.");
        process.exit(0);
    });

    // Handle uncaught errors
    process.on("unhandledRejection", async (reason, promise) => {
        console.error("Unhandled Rejection at:", promise, "reason:", reason);
        await cleanup();
        process.exit(1);
    });
}

async function init() {
    try {
        // Prevent double initialization
        if (mongoClient) {
            console.log("Data updater already initialized");
            return;
        }

        mongoClient = await MongoClient.connect(config.mongodb.url);
        cache.init(mongoClient);
        const comlinkStub = new ComlinkStub(config.swapiConfig.clientStub);

        if (!FORCE_UPDATE) {
            (async function runUpdatersAsNeeded() {
                debugTime("Total update cycle");

                debugTime("Checking metadata");
                const { isMetadataUpdated, newMetadata, oldMetadata } = (await updateMetadata(DATA_DIR_PATH, comlinkStub)) as {
                    isMetadataUpdated: boolean;
                    newMetadata: Metadata;
                    oldMetadata: Metadata;
                };
                debugTimeEnd("Checking metadata");

                if (isMetadataUpdated) {
                    const log = [];
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
                    if (log.length) console.log(["Found new metadata, running updaters", ...log].join("\n"));

                    debugTime("Running game data updaters");
                    await runGameDataUpdaters(newMetadata, cache, comlinkStub);
                    debugTimeEnd("Running game data updaters");
                    debugLog("Finished running game data updater for new metadata");
                }

                debugTime("Running mod updaters");
                await runModUpdaters(comlinkStub);
                debugTimeEnd("Running mod updaters");
                debugLog("Finished running all updaters");

                debugTimeEnd("Total update cycle");

                // Run it again each 24 hours - store timeout reference
                updatersTimeout = setTimeout(runUpdatersAsNeeded, 24 * 60 * 60 * 1000);
            })();

            // Run the Patreon updater every 15 minutes - store interval reference
            patronsInterval = setInterval(async () => await updatePatrons(cache), 15 * 60 * 1000);
        } else {
            // TODO: Add a way to choose what's updated from the cmdline without having to manually change which bit we want updated
            // If we're forcing an update, just run the bits we want then exit
            console.log("Forcing update, running updaters");
            const { newMetadata } = (await updateMetadata(DATA_DIR_PATH, comlinkStub)) as {
                isMetadataUpdated: boolean;
                newMetadata: Metadata;
                oldMetadata: Metadata;
            };
            await runGameDataUpdaters(newMetadata, cache, comlinkStub);
            // await updatePatrons(cache);
            await cleanup();
            process.exit(0);
        }
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

    const metadataOut = {};
    let oldMetadata = {};
    try {
        oldMetadata = await readJSON(META_FILE);
    } catch (error) {
        debugLog(`No existing metadata (${error.code || error.message}). Creating new metadata.`);
    }
    let isMetadataUpdated = false;
    for (const key of META_KEYS) {
        if (newMetaData[key] !== oldMetadata[key]) {
            isMetadataUpdated = true;
            debugLog(`Updating metadata ${key} from ${oldMetadata[key]} to ${newMetaData[key]}`);
            metadataOut[key] = newMetaData[key];
        } else {
            metadataOut[key] = oldMetadata[key];
        }
    }

    if (isMetadataUpdated) {
        await saveFile(META_FILE, metadataOut);
    }

    return { isMetadataUpdated, newMetadata: metadataOut, oldMetadata };
}

async function runModUpdaters(comlinkStub: ComlinkStub) {
    debugTime("Getting guildIds");
    const guildIds = await getGuildIds(comlinkStub);
    debugTimeEnd("Getting guildIds");

    // Grab the player IDs for each player in each of those guilds
    debugTime("Getting guildPlayerIds");
    const playerIds = await getGuildPlayerIds(comlinkStub, guildIds);
    debugTimeEnd("Getting guildPlayerIds");

    // Grab the defId and needed mod info for each of those players' units
    debugTime("Getting playerRosters");
    const modMap = await readJSON<ModMap>(path.join(DATA_DIR_PATH, "modMap.json"));
    const playerUnits = await getPlayerRosters(playerIds, modMap);
    debugTimeEnd("Getting playerRosters");

    // Get list which sets of mods each character has and record the
    // primary stats each of them has per slot
    debugTime("Processing unitMods");
    const unitsOut = await processUnitMods(playerUnits);
    debugTimeEnd("Processing unitMods");

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

async function runGameDataUpdaters(metadata: Metadata, cache: BotCache, comlinkStub: ComlinkStub) {
    debugLog("Running gameData updater");
    const time = new Date().toString().split(" ").slice(1, 5);
    const log = [];

    const locales = await getLocalizationData(comlinkStub, metadata.latestLocalizationBundleVersion);

    // TODO Change updateGameData to return a log array so it can all be logged nicely with the locations?
    await updateGameData(locales, metadata, cache, comlinkStub); // Run the stuff to grab all new game data, and update listings in the db
    debugLog("Finished processing gameData chunks");

    // Run unit locations updaters in parallel
    const [charLocsResult, shipLocsResult] = await Promise.all([
        updateLocs(CHAR_FILE_PATH, CHAR_LOCATIONS_FILE_PATH, locales, cache),
        updateLocs(SHIP_FILE_PATH, SHIP_LOCATIONS_FILE_PATH, locales, cache),
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

    if (log?.length) {
        console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}`);
        console.log(log.join("\n"));
    } else {
        // console.log(`Ran updater - ${time[0]} ${time[1]}, ${time[2]} - ${time[3]}  ##  Nothing updated`);
    }
    debugLog("Finished running gameData updaters");
}

async function saveFile(filePath: string, jsonData: [] | object, doPretty = true) {
    try {
        const content = doPretty ? JSON.stringify(jsonData, null, 4) : JSON.stringify(jsonData);
        await writeFile(filePath, content);
    } catch (error) {
        logError("dataUpdater/saveFile", `Failed to save file ${filePath}:`, error);
    }
}

const setLang = { 1: "Health", 2: "Offense", 3: "Defense", 4: "Speed", 5: "Crit. Chance", 6: "Crit. Damage", 7: "Potency", 8: "Tenacity" };
const statLang = {
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

        return guildLeaderboardRes.leaderboard[0].guild.map((guild) => guild.id);
    } catch (error) {
        console.error(`[${myTime()}] [dataUpdater/getGuildIds] Failed to fetch guild leaderboard:`, error);
        throw error; // Re-throw to let caller handle
    }
}

async function getGuildPlayerIds(comlinkStub: ComlinkStub, guildIds: string[]) {
    const playerIdArr = [];
    let failedGuilds = 0;

    // Get all the players' IDs from each guild
    await eachLimit(guildIds, MAX_CONCURRENT, async (guildId) => {
        try {
            const { guild } = (await withTimeout(comlinkStub.getGuild(guildId), 30000, `getGuild(${guildId})`)) as getGuildResponse;

            // Validate response structure
            if (!guild?.member) {
                console.warn(`[${myTime()}] [dataUpdater/getGuildPlayerIds] Invalid guild data for ${guildId}`);
                failedGuilds++;
                return;
            }

            const playerIds = guild.member.map((player) => player.playerId);
            playerIdArr.push(...playerIds);
        } catch (error) {
            console.error(`[${myTime()}] [dataUpdater/getGuildPlayerIds] Failed to fetch guild ${guildId}:`, error);
            failedGuilds++;
        }
    });

    if (failedGuilds > 0) {
        console.warn(`[${myTime()}] [dataUpdater/getGuildPlayerIds] Failed to fetch ${failedGuilds}/${guildIds.length} guilds`);
    }

    return playerIdArr;
}

// Stick all of the characters from each player's rosters into an array ot be processed later
async function getPlayerRosters(playerIds: string[], modMap: ModMap) {
    debugLog(`Getting rosters for ${playerIds.length} players (${MAX_CONCURRENT} at a time)`);
    const rosterArr = [];

    let playerCount = 0;

    // Create pool locally for this operation
    const piscina = new Piscina({
        filename: path.resolve(import.meta.dirname, "../modules/workers/getStrippedModsWorker.ts"),
        taskQueue: new FixedQueue(),
    });

    try {
        await eachLimit(playerIds, MAX_CONCURRENT, async (playerId) => {
            try {
                playerCount++;
                const strippedUnits = await piscina.run({ playerId, modMap, clientStub: config.swapiConfig.clientStub });
                rosterArr.push(...(strippedUnits || []));
            } catch (err) {
                console.error(`[${myTime()}] [dataUpdater/getPlayerRosters] Failed to process player ${playerId}:`, err);
            }
        });

        if (playerCount !== playerIds.length) {
            console.error(
                `[${myTime()}] [dataUpdater/getPlayerRosters] Found ${playerCount} players, but ${playerIds.length} were requested`,
            );
        }
    } finally {
        // Always close, even if errors occurred
        await piscina.close();
        debugLog("Closed worker pool");
    }

    return rosterArr;
}

async function processUnitMods(unitsIn: SWAPIUnit[]) {
    const unitsOut = {};

    for (const unit of unitsIn) {
        const { mods, defId } = unit;
        if (!mods?.length) continue;
        if (!unitsOut[defId]) {
            unitsOut[defId] = { primaries: {}, sets: {} };
        }

        // Build primaryStr and count sets in a single pass over mods
        const primaryParts = [];
        const unitSets = {};
        for (let i = 0; i < mods.length; i++) {
            const mod = mods[i];
            primaryParts.push(`${i + 1}-${mod.primaryStat}`);
            incrementInObj(unitSets, mod.set);
        }

        const primaryStr = primaryParts.join("_");
        if (!primaryStr.length) continue;
        incrementInObj(unitsOut[defId].primaries, primaryStr);

        // Build setStr efficiently
        const setParts = [];
        for (const [set, count] of Object.entries(unitSets)) {
            setParts.push(`${count}x${set}`);
        }
        const setStr = setParts.join("_");
        if (!setStr.length) continue;
        incrementInObj(unitsOut[defId].sets, setStr);
    }

    return unitsOut;
}

function incrementInObj(obj: object, key: string | number) {
    obj[key] = obj[key] ? obj[key] + 1 : 1;
    return obj;
}

const multiSets = {
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
    const unitsOut = {};
    for (const defId of Object.keys(unitsIn)) {
        const thisUnit = unitsIn[defId];
        const { primaries, sets } = thisUnit;
        const unitOut = { mods: { sets: null } };

        const maxPrimaryCount = Math.max(...Object.values(primaries));
        const maxSetCount = Math.max(...Object.values(sets));

        const filteredPrimaries = Object.entries(primaries)
            .filter(([_, count]) => count === maxPrimaryCount)
            .map(([prim]) => prim.split("_"));
        const primariesOut = {};
        const primarySlots = filteredPrimaries[0] || [];
        for (const [ix, slot] of primarySlots.entries()) {
            const stat = slot.split("-")[1];
            primariesOut[slotNames[ix]] = statLang[stat];
        }

        unitOut.mods = {} as BotUnitMods;

        const filteredSets = Object.entries(sets)
            .filter(([_, count]) => count === maxSetCount)
            .map(([set]) => set.split("_"));
        const totalSets = filteredSets[0] || [];
        const setStrings = totalSets.map((set) => {
            const [count, stat] = set.split("x");
            return `${setLang[stat]} x${count}`;
        });

        const setsOut = [];
        for (const set of setStrings) {
            if (multiSets[set]) {
                setsOut.push(...multiSets[set]);
            } else {
                setsOut.push(set);
            }
        }

        unitOut.mods.sets = setsOut;

        unitsOut[defId] = unitOut;
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

async function updatePatrons(cache: BotCache) {
    const patreon = config.patreonV2;
    if (!patreon) return;

    try {
        // Use the given patId to get all of the supporters
        // https://docs.patreon.com/#get-api-oauth2-v2-campaigns
        const response = await fetch(
            `https://www.patreon.com/api/oauth2/v2/campaigns/${patreon.campaignId}/members?include=user&fields%5Bmember%5D=full_name,currently_entitled_amount_cents,patron_status,email&fields%5Buser%5D=social_connections&page%5Bcount%5D=200`,
            {
                headers: {
                    Authorization: `Bearer ${patreon.creatorAccessToken}`,
                },
                signal: AbortSignal.timeout(30000), // 30 second timeout
            },
        );

        // Check response status
        if (!response.ok) {
            console.error(`[${myTime()}] [dataUpdater/updatePatrons] Patreon API returned ${response.status}: ${response.statusText}`);
            return;
        }

        // Parse JSON with error handling
        let jsonData: unknown;
        try {
            jsonData = await response.json();
        } catch (parseError) {
            console.error(`[${myTime()}] [dataUpdater/updatePatrons] Failed to parse Patreon response as JSON:`, parseError);
            return;
        }

        // Validate response structure
        if (
            typeof jsonData !== "object" ||
            jsonData === null ||
            !("data" in jsonData) ||
            !Array.isArray((jsonData as { data: unknown }).data)
        ) {
            console.error(`[${myTime()}] [dataUpdater/updatePatrons] Invalid response structure - missing data array`);
            return;
        }

        const { data, included = [] } = jsonData as { data: PatreonMember[]; included?: PatreonUser[] };

        // Validate included array
        if (!Array.isArray(included)) {
            console.warn(`[${myTime()}] [dataUpdater/updatePatrons] Invalid included field, using empty array`);
        }

        const members = data.filter((item: PatreonMember) => item.type === "member" && item.attributes.patron_status === "active_patron");
        const users = Array.isArray(included) ? included.filter((inc: PatreonUser) => inc.type === "user") : [];

        for (const member of members) {
            const user = users.find((user) => user.id === member.relationships?.user?.data?.id);

            // Couldn't find a user to match with the pledge (Shouldn't happen, but just in case)
            if (!user) {
                console.log(
                    `Patreon user not found for member: ${member.attributes?.full_name} (ID: ${member.relationships?.user?.data?.id})`,
                );
                continue;
            }

            // Check if the user is already in the db, and alert that there's a new supporter if not
            const discordID = user.attributes.social_connections?.discord?.user_id;
            if (discordID) {
                const userConf = await cache.getOne(config.mongodb.swgohbotdb, "patrons", { discordID: discordID });
                if (!userConf)
                    console.log(`[dataUpdater/updatePatrons] New Patreon supporter ${member.attributes.full_name} (${discordID || "N/A"})`);
            }

            // Save this user's info to the db
            const newUser = await cache.put(
                "swgohbot",
                "patrons",
                { id: member.relationships.user.data.id },
                {
                    id: member.relationships.user.data.id,
                    full_name: member.attributes.full_name,
                    email: member.attributes.email,
                    discordID: discordID,
                    amount_cents: member.attributes.currently_entitled_amount_cents,
                    patron_status: member.attributes.patron_status,
                },
            );

            // If they don't have a discord id to work with, move on
            if (!newUser.discordID) continue;

            if (newUser.patron_status !== "active_patron" || !newUser.amount_cents) {
                // If the user isn't currently active, make sure they don't have any bonusServers linked
                const userConf = (await cache.getOne(config.mongodb.swgohbotdb, "users", { id: newUser.discordID })) as UserConfig | null;

                // If they don't have bonusServer set (As it should be), move on
                if (!userConf?.bonusServer?.length) continue;

                // If it is set, remove it
                const { user: userRes, guild: guildRes } = await clearSupporterInfo({ cache, userId: newUser.discordID });

                // No issues, move on
                if (!userRes?.error && !guildRes?.error) {
                    console.log(`User ${newUser.discordID} has been ended their Patreon support`);
                    continue;
                }

                // If it somehow got here / there are issues, log em
                console.error(
                    `[${myTime()}] [dataUpdater clearSupporterInfo] Issue clearing info from user\n${userRes?.error || "N/A"} \nOr guild:\n${
                        guildRes?.error || "N/A"
                    }`,
                );
            } else {
                // If the user exists, and they're active, make sure everything is set correctly
                // Make sure that if they have a bonus server set in their user settings, it's set properly in the given guild
                const { user: userRes, guild: guildRes } = (await ensureBonusServerSet({
                    cache,
                    userId: newUser.discordID,
                    amount_cents: newUser.amount_cents,
                })) as { user: { success: boolean; error: string }; guild: { success: boolean; error: string } };

                // If there are no issues, move along
                if (!userRes?.error && !guildRes?.error) continue;

                // If there are issues, log em
                console.error(
                    `[${myTime()}] [dataUpdater addServerSupporter] Issue adding info for user\n${userRes?.error || "N/A"} \nOr guild:\n${
                        guildRes?.error || "N/A"
                    }`,
                );
            }
        }

        // Go through each of the guilds that have a supporter and make sure all of the lsited users are supposed to be there
        await ensureGuildSupporter({ cache });
    } catch (e) {
        if (e.name === "AbortError" || e.name === "TimeoutError") {
            console.error(`[${myTime()}] [dataUpdater/updatePatrons] Patreon API request timed out after 30 seconds`);
        } else {
            console.error(`[${myTime()}] [dataUpdater/updatePatrons] Error getting patrons:`, e);
        }
    }
}

async function updateLocs(
    unitListFile: string,
    currentLocFile: string,
    locales: Locales,
    cache: BotCache,
): Promise<{ locations: UnitLocation[]; hasChanges: boolean }> {
    debugLog(`Updating unit locations for ${unitListFile}`);
    const [currentUnits, currentLocs] = await Promise.all([readJSON<BotUnit[]>(unitListFile), readJSON<UnitLocation[]>(currentLocFile)]);

    const shardNameMap = currentUnits.map((unit) => `unitshard_${unit.uniqueName}`);
    const shardNameRes = (await cache.get(config.mongodb.swapidb, "materials", { id: { $in: shardNameMap } })) as { id: string }[];

    const matArr = [];
    for (const unit of currentUnits) {
        const res = shardNameRes.find((mat) => mat?.id === `unitshard_${unit.uniqueName}`);
        if (res) {
            matArr.push({
                defId: unit.uniqueName,
                mats: res,
            });
        }
    }

    if (!matArr.length) return;

    const langList = Object.keys(locales);
    const targets = {
        HARD_DARK: ["FeatureTitle_DarkCampaigns", "DIFF_HARD"],
        HARD_FLEET: ["FeatureTitle_ShipPve", "DIFF_HARD"],
        HARD_LIGHT: ["FeatureTitle_LightCampaigns", "DIFF_HARD"],
        CANTINA: ["KEYBINDING_NAME_CANTINA_BATTLES"],
        // CANTINA: ["FeatureTitle_DatacronBattles"],
    };
    const bulkLocPut = [];
    for (const lang of langList) {
        for (const target of Object.keys(targets)) {
            const langKey = targets[target].map((t: string) => locales[lang][t] || `ERROR: ${t}`).join(" ");
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
    await cache.putMany(config.mongodb.swapidb, "locations", bulkLocPut);

    const [campaignMapNames, campaignMapNodes, featureStoreList] = await Promise.all([
        readJSON<unknown[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/campaignMapNames.json")).then((data) => data[0]),
        readJSON<unknown[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/campaignMapNodes.json")).then((data) => data[0]),
        readJSON<FeatureStore[]>(path.join(DATA_DIR_PATH, "swgoh-json-files/featureStoreList.json")),
    ]);

    const outArr = [];
    for (const mat of matArr) {
        const missions = mat?.mats?.lookupMissionList || [];

        const charArr = [];
        const usedLocId = new Set();
        for (const node of missions) {
            let locId = null;
            let charObj = {} as { type: string; locId: string; name?: string };

            // Skip ones that haven't existed for years
            if (["BASICTRAINING"].includes(node.campaignMapId)) continue;
            if (["FLASH_LUKE"].includes(node.campaignNodeId)) continue;

            if (node.campaignId === "EVENTS") {
                if (node.campaignMapId === "MARQUEE") {
                    // Run through stuff for Marquee events
                    locId = `EVENT_MARQUEE_${node.campaignNodeId.split("_")[0]}_NAME`;
                    charObj = { type: "Marquee", locId };
                } else if (node.campaignMapId === "PROGRESSION") {
                    // Process the two progression events (GMY / EP)
                    locId = `PROGRESSIONEVENT_${node.campaignNodeId}_NAME`;
                    charObj = { type: "Legendary Event", locId };
                } else if (node.campaignMapId === "JOURNEY") {
                    const journeyKeys = ["JOURNEY_JEDIKNIGHTLUKE", "JOURNEY_DARTHREVAN"];
                    if (journeyKeys.some((key) => node.campaignNodeId.includes(key))) {
                        locId = `EVENT_JOURNEY_${mat.defId}_NAME`;
                    } else if (node.campaignNodeId === "HEROJOURNEY_SCAVENGERREY") {
                        locId = "EVENT_HERO_SCAVENGERREY_NAME";
                    } else {
                        locId = check1or2(`${mat.defId}_GUIDE_DETAILS_TITLE`, locales.eng_us);
                    }
                    charObj = { type: "Hero's Journey", locId };
                } else if (node.campaignMapId === "LEGENDARY") {
                    if (["THE_FORCE_UNLEASHED", "DARK_TIMES"].includes(node.campaignNodeId)) {
                        locId = `${mat.defId}_JOURNEY_GUIDE_EVENT_TITLE_V2`;
                    } else {
                        locId = check1or2(`${mat.defId}_GUIDE_DETAILS_TITLE`, locales.eng_us);
                    }
                    charObj = { type: "Legendary Event", locId };
                } else if (node.campaignMapId === "EPIC") {
                    if (node.campaignNodeId === "CLASH_ON_KAMINO") {
                        locId = `EPIC_CONFRONTATION_${node.campaignNodeId}_NAME`;
                    } else {
                        locId = `MYTHICEVENT_${node.campaignNodeId}_V2`;
                    }
                    charObj = { type: "Epic Confrontation", locId };
                } else if (node.campaignMapId === "HEROIC") {
                    locId = `EVENT_${node.campaignNodeId.replace("NODE_EVENT_", "")}_NAME`;
                    charObj = { type: "Heroic Event", locId };
                } else if (node.campaignMapId === "FLEETMASTERY") {
                    locId = `EVENT_FLEET_MASTERY_${mat.defId}_NAME`;
                    charObj = { type: "Fleet Event", locId };
                } else if (node.campaignMapId === "SCHEDULED") {
                    if (node.campaignNodeId === "CONQUEST_UNIT_TRIALS") {
                        // Process the Proving Grounds events
                        // - Really just localize "Proving Grounds" since the rest is just the unit's name
                        locId = "EVENT_CONQUEST_UNIT_TRIALS_NAME";
                        charObj = { type: "Proving Grounds", locId };
                    } else if (node.campaignNodeId.includes("GHOSTS_OF_DATHOMIR")) {
                        locId = "EVENT_HOLIDAY_GHOSTS_OF_DATHOMIR_NAME";
                        charObj = { type: "Special Event", locId };
                    } else if (node.campaignNodeId.startsWith("NODE_EVENT_ASSAULT")) {
                        locId = `EVENT_ASSAULT_${node.campaignNodeId.split("_").pop()}_NAME`;
                        charObj = { type: "Assault Battle Event", locId };
                    } else if (node.campaignNodeId.includes("GALACTIC_BOUNTY")) {
                        locId = "EVENT_GALACTIC_BOUNTY_01_NAME";
                        charObj = { type: "Galactic Bounty Event", locId };
                    }
                } else if (node.campaignMapId === "GALACTIC") {
                    // Process galactic legends events
                    //  - Still not sure how to manage LORDVADER in place of VADER
                    const commonStr = node.campaignNodeId.replace("CAMPAIGN_", ""); // Replace junk
                    const possibleKeys = [
                        `NODE_CAMPAIGN_${commonStr}_NAME`,
                        `${commonStr}_NAME`,
                        `EVENT_${mat.defId}_GALACTICLEGEND_NAME_V2`,
                        `EVENT_${mat.defId}_GALACTICLEGEND_NAME`,
                    ];

                    for (const possible of possibleKeys) {
                        if (locales.eng_us[possible]) {
                            locId = possible;
                            break;
                        }
                    }

                    charObj = { type: "Galactic Ascension", locId };
                } else {
                    // console.log(`[updateLocs] Unknown campaign: ${node.campaignId} - ${node.campaignMapId} - ${node.campaignNodeId}`);
                    continue;
                }

                if (!locId || usedLocId.has(locId)) continue;
                usedLocId.add(locId);

                // Go through and save all the locale strings into the db
                let isAvailable = true;
                for (const lang of langList) {
                    const langKey = locales[lang][locId];
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
                    await cache.put(config.mongodb.swapidb, "locations", { id: locId, language: lang }, out);
                }
                // If locale strings were available, go ahead and stick the info in
                if (isAvailable) charArr.push(charObj);
            } else {
                // Run stuff through for hard nodes
                const outMode = campaignMapNames[node.campaignId]?.game_mode;
                if (!outMode) continue;

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
                const { suffix, locId } = modeMap[outMode] || modeMap.default;

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
            if (!thisUnit) continue;

            charArr.push({
                type: store.storeId,
                cost: thisUnit.purchaseList.map(({ cost, currency, quantity }) => `${cost} ${currency}/${quantity}`).join("\n"),
            });
        }

        outArr.push({ defId: mat.defId, locations: charArr });
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
    const finalOut = [];
    const locationMap = {};
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
        const unitLoc = outArr.find((loc) => loc.defId === unit.uniqueName) || { defId: unit.uniqueName };

        const locations: Location[] = removeDuplicates([...thisUnitLoc, ...(unitLoc?.locations || [])]);
        const unitName = thisUnitLoc.name || unitLoc.name || unit.name;

        if (!unitName && !unitLoc.defId) continue;

        const newUnitData = {
            name: unitName,
            defId: unitLoc.defId,
            locations: locations.sort((a, b) => (a.type?.toLowerCase() > b.type?.toLowerCase() ? 1 : -1)),
        };

        // Detect changes as we build the output
        if (!hasChanges) {
            const oldUnitData = oldLocsMap.get(unitLoc.defId);
            if (!oldUnitData) {
                // New unit added
                hasChanges = true;
            } else if (oldUnitData.locations.length !== newUnitData.locations.length) {
                // Locations changed for existing unit
                hasChanges = true;
            }
        }

        finalOut.push(newUnitData);
    }

    // Sort the final output array
    const sortedOut = finalOut.sort((a, b) => {
        const nameA = a?.name?.toLowerCase() || "";
        const nameB = b?.name?.toLowerCase() || "";
        return nameA > nameB ? 1 : -1 || a.defId.toLowerCase() > b.defId.toLowerCase() ? 1 : -1;
    });

    // Final check if we haven't detected changes yet
    if (!hasChanges && sortedOut.length !== currentLocs.length) {
        hasChanges = true;
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

function check1or2(strIn: string, locale: Record<string, string>) {
    if (locale?.[strIn]) {
        return strIn;
    }
    if (locale?.[`${strIn}_2`]) {
        return `${strIn}_2`;
    }
    return null;
}

async function getMostRecentGameData(comlinkStub: ComlinkStub, version: string) {
    let gameData = null;
    const dataFile = `gameData_${version}.json`;
    const filePath = path.join(GAMEDATA_DIR_PATH, dataFile);

    // Try to read cached file
    try {
        const gameData = await readJSON(filePath);
        debugLog(`Found gameData for ${version}`);
        return gameData;
    } catch (error) {
        // File doesn't exist or can't be read, fetch new data
        debugLog(`No cached gameData for ${version} (${error.code || error.message}), fetching new copy`);
    }

    // If we don't have the most recent version locally, grab a new copy of the gameData from CG
    gameData = (await withTimeout(comlinkStub.getGameData(version, false), 60000, "getGameData")) as operations["getGameData"]["responses"];

    // This is going to be a new version, so we can just delete the old files
    const allFiles = await readdir(GAMEDATA_DIR_PATH);
    const oldFiles = allFiles.filter((fileName) => fileName.startsWith("gameData_") && fileName !== dataFile);
    await Promise.all(
        oldFiles.map(async (f) => {
            try {
                await unlink(path.join(GAMEDATA_DIR_PATH, f));
            } catch (error) {
                // Ignore ENOENT (file already deleted), log other errors
                if (error.code !== "ENOENT") {
                    console.warn(`[${myTime()}] [getMostRecentGameData] Failed to delete old file ${f}:`, error);
                }
            }
        }),
    );

    // Then save it
    await writeFile(filePath, JSON.stringify(gameData));

    // Then return the gameData
    return gameData;
}

function validateGameData(gameData: GameData): void {
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

    const missingKeys = requiredKeys.filter((key) => !gameData[key] || !Array.isArray(gameData[key]));
    if (missingKeys.length > 0) {
        throw new Error(`[validateGameData] Missing or invalid gameData keys: ${missingKeys.join(", ")}`);
    }
}

async function updateGameData(locales: Locales, metadata: Metadata, cache: BotCache, comlinkStub: ComlinkStub) {
    try {
        if (!metadata.latestGamedataVersion) {
            throw new Error("[updateGameData] Missing latestGamedataVersion from metadata");
        }

        debugLog("Running main updaters");

        const gameData = await getMostRecentGameData(comlinkStub, metadata.latestGamedataVersion);

        await processGameData(gameData, locales, cache);
    } catch (error) {
        logError("dataUpdater/updateGameData", "Error processing game data:", error);
        throw error;
    }
}

async function processGameData(gameData: GameData, locales: Locales, cache: BotCache) {
    try {
        debugTime("Finished processing all GameData");
        // Validate gameData structure before processing
        validateGameData(gameData);

        const { abilitiesOut, skillMap } = processAbilities(gameData.ability, gameData.skill);
        await saveFile(path.join(DATA_DIR_PATH, "skillMap.json"), skillMap, false);
        await processLocalization(abilitiesOut, "abilities", ["nameKey", "descKey", "abilityTiers"], "id", locales, cache);
        debugLog("Finished processing Abilities");

        debugTime("Finished processing Categories");
        const catMapOut = (await processCategories(gameData.category)) as { id: string; descKey: string }[];
        // await saveFile(dataDir + "catMap.json", catMapOut, false);
        await processLocalization(catMapOut, "categories", ["descKey"], "id", locales, cache);
        debugTimeEnd("Finished processing Categories");

        debugTime("Finished processing Equipment");
        const mappedEquipmentList = await processEquipment(gameData.equipment);
        await processLocalization(mappedEquipmentList, "gear", ["nameKey"], "id", locales, cache);
        debugTimeEnd("Finished processing Equipment");

        debugTime("Finished processing Materials");
        const { unitShardList, bulkMatArr } = processMaterials(gameData.material);
        await cache.putMany(config.mongodb.swapidb, "materials", bulkMatArr);
        debugTimeEnd("Finished processing Materials");

        debugTime("Finished processing Mod data");
        const modsOut = processModData(gameData.statMod);
        await saveFile(path.join(DATA_DIR_PATH, "modMap.json"), modsOut, false);
        debugTimeEnd("Finished processing Mod data");

        debugTime("Finished processing Recipes");
        const { unitRecipeList, mappedRecipeList } = processRecipes(gameData.recipe);
        await processLocalization(mappedRecipeList, "recipes", ["descKey"], "id", locales, cache, ["eng_us"]);
        debugTimeEnd("Finished processing Recipes");

        const processedUnitList = processUnits(gameData.units);

        // Put all the baseId and english names together for later use with the crew
        const unitDefIdMap: Record<string, string> = {};
        for (const unit of processedUnitList) {
            unitDefIdMap[unit.baseId] = locales.eng_us[unit.nameKey];
        }

        const bulkUnitArr = unitsToCharacterDB(structuredClone(processedUnitList));
        await cache.putMany(config.mongodb.swapidb, "characters", bulkUnitArr);
        await processLocalization(processedUnitList, "units", ["nameKey"], "baseId", locales, cache);

        const unitsOut = unitsForUnitMapFile(processedUnitList);
        await saveFile(path.join(DATA_DIR_PATH, "unitMap.json"), unitsOut, false);

        // Update & save the character/ship.json files (Not being tested, because it mashes so many bits together to make it work)
        const { charactersOut, shipsOut } = await unitsToUnitFiles(
            processedUnitList,
            locales,
            catMapOut,
            unitDefIdMap,
            unitRecipeList,
            unitShardList,
        );
        await saveFile(CHAR_FILE_PATH, sortByName(charactersOut));
        await saveFile(SHIP_FILE_PATH, sortByName(shipsOut));
        debugLog("Finished processing Units");

        await processJourneyReqs(gameData);
        debugLog("Finished processing Journey Reqs");

        const raidNamesOut = saveRaidNames(locales);
        await saveFile(RAID_NAMES_FILE_PATH, raidNamesOut);
        debugLog("Finished processing Raid Names");
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
              [key: string]: string | string[] | Record<string, string>;
          }[],
    dbTarget: string,
    targetKeys: string[],
    dbIdKey: string,
    locales: Locales,
    cache: BotCache,
    langList: SWAPILang[] = null,
) {
    const idKey = dbIdKey || "id";
    const thisLangList = langList || Object.keys(locales);
    const bulkWriteArr = [];

    for (const lang of thisLangList) {
        // For each language that we need to localize for...
        for (const data of rawDataIn) {
            // For each chunk of the dataIn (ability, gear, recipes, unit, etc)
            // Create new object instead of mutating - eliminates need for structuredClone
            const localizedData = { ...data, language: lang };

            for (const target of targetKeys) {
                // For each of the specified keys of each chunk
                localizedData[target] = Array.isArray(data[target])
                    ? data[target].map((entry) => locales[lang][entry] || entry)
                    : locales[lang][data[target]] || data[target];
            }
            bulkWriteArr.push({
                updateOne: {
                    filter: { [idKey]: localizedData[idKey], language: lang }, // Filter by the given key, and language
                    update: { $set: localizedData }, // Update with the localized data
                    upsert: true, // Insert if document doesn't exist
                },
            });
        }
        // console.log(`Finished localizing ${dbTarget} for ${lang}`);
    }

    // Batch operations to avoid MongoDB's 1000-operation limit
    const BATCH_SIZE = 1000;
    if (bulkWriteArr.length > BATCH_SIZE) {
        for (let i = 0; i < bulkWriteArr.length; i += BATCH_SIZE) {
            const batch = bulkWriteArr.slice(i, i + BATCH_SIZE);
            await cache.putMany(config.mongodb.swapidb, dbTarget, batch);
        }
    } else {
        await cache.putMany(config.mongodb.swapidb, dbTarget, bulkWriteArr);
    }
    // console.log(`Finished localizing ${dbTarget}`);
}

function saveRaidNames(locales: Locales) {
    const langList = Object.keys(locales);

    // The keys that match in the lang files, and the keys that the guild raids give
    const raidKeys = {
        RAID_AAT_NAME: "aat",
        RAID_RANCOR_NAME: "rancor",
        RAID_RANCOR_CHALLENGE_NAME: "rancor_challenge",
        RAID_TRIUMVIRATE_NAME: "sith_raid",
        MISSION_GUILDRAIDS_KRAYTDRAGON_NAME: "kraytdragon",
        MISSION_GUILDRAIDSLEGACY_HEROIC_NAME: "heroic",
        MISSION_GUILDRAIDS_SPEEDERBIKE_NAME: "speederbike",
        MISSION_GUILDRAIDS_NABOO_NAME: "naboo",
        MISSION_GUILDRAIDS_ORDER66_NAME: "order66",
    };
    const raidNamesOut = {};
    for (const lang of langList) {
        raidNamesOut[lang] = {};
        for (const [key, value] of Object.entries(raidKeys)) {
            raidNamesOut[lang][value] = locales[lang][key];
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
        if (!skill) continue;

        const abTiers = ability.tier?.map((ti) => ti.descKey) || [];
        const tierList = skill.tier.map((t) => t.recipeId);
        let isZeta = false;
        let zetaTier = null;
        let omicronTier = null;
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
            nameKey: ability.nameKey,
            descKey: abTiers.slice(-1)[0] || ability.descKey,
            cooldown: ability.cooldown,
            abilityTiers: abTiers,
            skillId: skill.id,
            tierList,
            isZeta,
            zetaTier,
            isOmicron,
            omicronTier,
        });

        skillMap[skill.id] = {
            nameKey: ability.nameKey,
            isZeta,
            tiers: skill.tier.length,
            abilityId: skill.abilityReference,
        };
    }
    return { abilitiesOut, skillMap };
}

function processCategories(catsIn: comlinkComponents["Category"][]) {
    const catMapOut = catsIn.filter((cat) => cat.visible || cat.id.startsWith("alignment")).map(({ id, descKey }) => ({ id, descKey }));

    return catMapOut;
}

function processEquipment(equipmentIn: comlinkComponents["EquipmentDef"][]) {
    const mappedEquipmentList = equipmentIn.map(({ id, nameKey, recipeId, mark }) => ({ id, nameKey, recipeId, mark }));
    return mappedEquipmentList;
}

function processMaterials(materialIn: components["schemas"]["CraftingMaterialDef"][]) {
    const unitShardList: { id: string; iconKey: string }[] = [];
    const bulkMatArr = [];

    for (const mat of materialIn) {
        if (!mat.id.startsWith("unitshard")) continue;
        unitShardList.push({
            id: mat.id,
            iconKey: mat.iconKey.replace(/^tex\./, ""),
        });

        bulkMatArr.push({
            updateOne: {
                filter: { id: mat.id },
                update: {
                    $set: {
                        id: mat.id,
                        lookupMissionList: mat.lookupMission.map((mis) => mis.missionIdentifier),
                        raidLookupList: mat.raidLookup.map((mis) => mis.missionIdentifier),
                        iconKey: mat.iconKey,
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
    const modsOut = {};
    for (const { id, rarity, setId, slot } of modsIn) {
        modsOut[id] = {
            pips: rarity,
            set: setId,
            slot: slot,
        };
    }
    return modsOut;
}

function processRecipes(recipeIn: comlinkComponents["Recipe"][]) {
    const mappedRecipeList = [] as RecipeMap[];
    const unitRecipeList: { id: string; unitShard: string }[] = [];

    for (const recipe of recipeIn) {
        const { id, descKey, ingredients } = recipe;
        const filteredIngredients = ingredients.filter((ing) => ing.id !== "GRIND");

        // Add recipe to mappedRecipeList
        mappedRecipeList.push({
            id,
            descKey,
            ingredients: filteredIngredients,
        });

        // Add unitshard information to unitRecipeList
        const unitShardList = filteredIngredients.filter((ing) => ing.id?.startsWith("unitshard"));
        if (unitShardList.length) {
            unitRecipeList.push({
                id,
                unitShard: unitShardList[0].id,
            });
        }
    }

    return { unitRecipeList, mappedRecipeList };
}

function processUnits(unitsIn: comlinkComponents["UnitDef"][]): ProcessedUnit[] {
    return unitsIn
        .filter((unit) => {
            // @ts-expect-error - The generated type for obtainableTime *should* be string, but is number
            if (unit.rarity !== 7 || !unit.obtainable || (unit.obtainableTime !== 0 && unit.obtainableTime !== "0")) return false;
            return true;
        })
        .map((unit) => {
            return {
                baseId: unit.baseId, // uniqueName
                nameKey: unit.nameKey, // name
                skillReferenceList: unit.skillReference,
                categoryIdList: unit.categoryId,
                combatType: unit.combatType,
                unitTierList: unit.unitTier?.map((tier) => {
                    return {
                        tier: tier.tier,
                        equipmentSetList: tier.equipmentSet,
                    };
                }),
                crewList: unit.crew,
                creationRecipeReference: unit.creationRecipeReference,
                legend: unit?.legend, // True if GL?
            };
        });
}

async function unitsToUnitFiles(
    filteredList: ProcessedUnit[],
    locales: Locales,
    catMap: { id: string; descKey: string }[],
    unitDefIdMap: Record<string, string>,
    unitRecipeList: { id: string; unitShard: string }[],
    unitShardList: { id: string; iconKey: string }[],
) {
    const [oldCharFile, oldShipFile] = await Promise.all([readJSON<BotUnit[]>(CHAR_FILE_PATH), readJSON<BotUnit[]>(SHIP_FILE_PATH)]);
    const engStringMap = locales.eng_us;

    // Build lookup maps for O(1) access
    const recipeMap = new Map(unitRecipeList.map((r) => [r.id, r.unitShard]));
    const shardMap = new Map(unitShardList.map((s) => [s.id, s.iconKey]));

    const charactersOut = [];
    const shipsOut = [];

    for (const unit of filteredList) {
        const oldFile = unit.combatType === CHAR_COMBAT_TYPE ? oldCharFile : oldShipFile;
        const oldUnit = oldFile.find((u) => u.uniqueName === unit.baseId);
        const charUIName = getCharUIName(unit.creationRecipeReference, recipeMap, shardMap);
        const name = engStringMap?.[unit.nameKey] || unit.nameKey;

        let unitObj: BotUnit;
        if (oldUnit) {
            unitObj = oldUnit;
            unitObj.avatarName = charUIName;
            unitObj.avatarURL = `https://game-assets.swgoh.gg/textures/tex.${charUIName}.png`;
        } else {
            const unitFactionsObj = catMap.filter((cat) => unit.categoryIdList.includes(cat.id));
            const { factions, side } = getSide(unitFactionsObj);
            unitObj = {
                name,
                uniqueName: unit.baseId,
                aliases: [name],
                avatarName: charUIName,
                avatarURL: `https://game-assets.swgoh.gg/textures/tex.${charUIName}.png`,
                side,
                factions: factions.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)),
                mods: unit.combatType === CHAR_COMBAT_TYPE ? ({} as BotUnitMods) : null,
                crew: (unit.combatType === SHIP_COMBAT_TYPE && unit.crewList?.map((cr) => unitDefIdMap[cr.unitId])) || [],
            };
        }

        if (unit.combatType === CHAR_COMBAT_TYPE) {
            charactersOut.push(unitObj);
        } else if (unit.combatType === SHIP_COMBAT_TYPE) {
            shipsOut.push(unitObj);
        } else {
            console.error(`[${myTime()}] Bad combatType for:`, unitObj);
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
}

function sortByName(list: { name: string }[]) {
    return list.sort((a, b) => (a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1));
}

function unitsToCharacterDB(unitsIn: ProcessedUnit[]) {
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
        imperialremnant: "imerpial remnant",
        imperialtrooper: "imperial trooper",
        inquisitoriu: "inquisitorius",
        light: "light side",
        oldrepublic: "old republic",
        rebelfighter: "rebel fighter",
        republic: "galactic republic",
        rogue: "rogue one",
        sithempire: "sith empire",
    };

    const bulkLocPut = [];

    // Process the units list to go into the characters db table
    for (const unit of unitsIn) {
        const factions: Set<string> = new Set();
        const crewIds = [];
        const skillReferences = unit.skillReferenceList || [];

        unit.nameKey = undefined;
        unit.creationRecipeReference = undefined;

        if (!unit.categoryIdList) {
            console.error(`[${myTime()}] Missing baseCharacter abilities for ${unit.baseId}`);
            continue;
        }
        for (const category of unit.categoryIdList) {
            const [prefix, faction] = category.split("_");
            if (catList.has(prefix) && !ignoreSet.has(faction)) {
                factions.add(toProperCase(factionMap[faction] || faction));
            }
        }

        unit.factions = Array.from(factions);
        unit.categoryIdList = undefined;

        if (unit.crewList?.length) {
            for (const crewChar of unit.crewList) {
                crewIds.push(crewChar.unitId);
                skillReferences.push(...crewChar.skillReference);
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
    const unitsOut = unitsIn.reduce((acc, unit) => {
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
        debugLog(`No cached localeData for ${bundleVersion} (${error.code || error.message}), fetching new copy`);
    }

    try {
        // If we don't have the most recent version locally, grab a new copy of the gameData from CG
        const localeData: Record<string, string> = await withTimeout(
            comlinkStub.getLocalizationBundle(bundleVersion, true),
            60000,
            "getLocalizationBundle",
        );

        const localeOut = {
            eng_us: null,
            ger_de: null,
            spa_xm: null,
            fre_fr: null,
            rus_ru: null,
            por_br: null,
            kor_kr: null,
            ita_it: null,
            tur_tr: null,
            chs_cn: null,
            cht_cn: null,
            ind_id: null,
            jpn_jp: null,
            tha_th: null,
        } as Locales;
        for (const [lang, content] of Object.entries(localeData)) {
            const out = {};
            if (lang === "Loc_Key_Mapping.txt") continue;
            const langKey = lang.replace(/^Loc_|\.txt$/gi, "").toLowerCase();
            if (!content) {
                console.warn(`[getLocalizationData] No content for ${langKey}`);
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
            localeOut[langKey] = out;
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
                    if (error.code !== "ENOENT") {
                        console.warn(`[${myTime()}] [getLocalizationData] Failed to delete old file ${f}:`, error);
                    }
                }
            }),
        );

        // Then save it
        console.log(`Saving localeData for ${bundleVersion}`);
        await writeFile(filePath, JSON.stringify(localeOut));

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

async function processJourneyReqs(gameData: GameData) {
    const characters = await readJSON<BotUnit[]>(CHAR_FILE_PATH);
    const ships = await readJSON<BotUnit[]>(SHIP_FILE_PATH);
    let oldReqs = {} as JourneyReqs;
    // Grab the existing saved data if available
    try {
        oldReqs = await readJSON<JourneyReqs>(JOURNEY_FILE_PATH);
    } catch (error) {
        // File doesn't exist yet, will be created
        debugLog(`No existing journey requirements file (${error.code || error.message}), creating new one`);
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
    const unitGuideOut = {};
    for (const unit of unitGuides) {
        const tempOut = {
            guideId: unit.guideId,
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
                const splitDesc = ev.descKey.split("_");
                const tier = Number.parseInt(splitDesc.pop(), 10);
                const type = splitDesc.pop();
                const defId = ev?.actionLinkDef?.link.split("=").pop();
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
        if (tempOut.reqs?.length) {
            unitGuideOut[unit.defId] = tempOut;
        }
    }

    // Process the old reqs data to keep any manual entries, and wipe out/ replace any automated ones
    const reqsOut = {};
    if (oldReqs && Object.keys(oldReqs).length) {
        for (const reqKey of Object.keys(oldReqs)) {
            const thisReq = oldReqs[reqKey];
            if (thisReq.type === "MIXED") {
                // Grab all the manually put in units
                const thisReqOut = thisReq.reqs.filter((unit) => unit.manual);
                const currentUnits = thisReqOut.map((unit) => unit.defId);

                // Go through each chunk from the auto section and get the units together
                for (const autoReq of thisReq.auto) {
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
            if (thisReq.type === "FACTION") {
                thisReq.reqs = characters
                    .filter((ch) => ch.factions.includes(thisReq.faction.name))
                    .map((ch) => {
                        return {
                            defId: ch.uniqueName,
                            type: thisReq.faction.type,
                            tier: thisReq.faction.tier,
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
    await writeFile(
        JOURNEY_FILE_PATH,
        JSON.stringify(
            {
                ...oldReqs,
                ...unitGuideOut,
            },
            null,
            4,
        ),
        { encoding: "utf-8" },
    );
}

const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;
function toProperCase(strIn: string) {
    return strIn.replace(/([^\W_]+[^\s-]*) */g, (txt) => {
        if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}

function debugTime(name: string) {
    if (!FORCE_UPDATE && !DEBUG_LOGS) return;
    if (!name?.length) return;
    console.time(name);
}
function debugTimeEnd(name: string) {
    if (!FORCE_UPDATE && !DEBUG_LOGS) return;
    if (!name?.length) return;
    console.timeEnd(name);
}

function debugLog(str: string | string[]) {
    if (!FORCE_UPDATE && !DEBUG_LOGS) return;
    if (typeof str === "string" && str.length) {
        console.log(str);
    } else {
        console.log(inspect(str, { depth: 5 }));
    }
}

function myTime() {
    return Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZone: "America/Los_Angeles",
    }).format(new Date());
}

function logError(context: string, message: string, error?: unknown) {
    console.error(`[${myTime()}] [${context}] ${message}`, error || "");
}

export default {
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

    processModResults,

    processJourneyReqs,
    saveRaidNames,

    saveFile,
    processLocalization,
};
