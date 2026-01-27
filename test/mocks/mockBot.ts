import constants from "../../data/constants/constants.ts";
import { defaultSettings } from "../../data/constants/defaultGuildConf.ts";
import { abilityCosts, factions, journeyReqs, missions, resources, ships } from "../../data/constants/units.ts";
import { getSideColor } from "../../modules/functions.ts";
import type { BotClient, BotType, BotUnit } from "../../types/types.ts";

// Mock character data
const mockCharacters: BotUnit[] = [
    // Galactic Legends
    { name: "Commander Luke Skywalker", uniqueName: "COMMANDERLUKESKYWALKER", side: "light", url: "https://swgoh.gg/characters/commander-luke-skywalker/", aliases: ["CLS", "Luke"], factions: ["Rebel", "Jedi", "Galactic Legend"] } as BotUnit,
    { name: "Sith Eternal Emperor", uniqueName: "SITHPALPATINE", side: "dark", url: "https://swgoh.gg/characters/sith-eternal-emperor/", aliases: ["SEE", "Palpatine"], factions: ["Sith", "Empire", "Galactic Legend"] } as BotUnit,
    { name: "Supreme Leader Kylo Ren", uniqueName: "SUPREMELEADERKYLOREN", side: "dark", url: "https://swgoh.gg/characters/supreme-leader-kylo-ren/", aliases: ["SLKR", "Kylo"], factions: ["First Order", "Galactic Legend"] } as BotUnit,
    { name: "Rey", uniqueName: "GLREY", side: "light", url: "https://swgoh.gg/characters/rey-galactic-legend/", aliases: ["GL Rey"], factions: ["Resistance", "Jedi", "Galactic Legend"] } as BotUnit,
    // Journey Characters
    { name: "Jedi Knight Luke Skywalker", uniqueName: "JEDIKNIGHTLUKE", side: "light", url: "https://swgoh.gg/characters/jedi-knight-luke-skywalker/", aliases: ["JKL"], factions: ["Rebel", "Jedi"] } as BotUnit,
    { name: "Jedi Knight Revan", uniqueName: "JEDIKNIGHTREVAN", side: "light", url: "https://swgoh.gg/characters/jedi-knight-revan/", aliases: ["JKR", "Revan"], factions: ["Jedi", "Old Republic"] } as BotUnit,
    // Meta Units
    { name: "Darth Vader", uniqueName: "DARTHVADER", side: "dark", url: "https://swgoh.gg/characters/darth-vader/", aliases: ["Vader", "DV"], factions: ["Sith", "Empire"] } as BotUnit,
    { name: "Grand Master Yoda", uniqueName: "GRANDMASTERYODA", side: "light", url: "https://swgoh.gg/characters/grand-master-yoda/", aliases: ["GMY", "Yoda"], factions: ["Jedi", "Galactic Republic"] } as BotUnit,
    { name: "Obi-Wan Kenobi (Old Ben)", uniqueName: "OLDBENKENOBI", side: "light", url: "https://swgoh.gg/characters/obi-wan-kenobi-old-ben/", aliases: ["Old Ben", "Ben"], factions: ["Jedi", "Rebel"] } as BotUnit,
    // Diverse Factions
    { name: "First Order Officer", uniqueName: "FIRSTORDEROFFICER", side: "dark", url: "https://swgoh.gg/characters/first-order-officer/", aliases: ["FOO"], factions: ["First Order"] } as BotUnit,
    { name: "Count Dooku", uniqueName: "COUNTDOOKU", side: "dark", url: "https://swgoh.gg/characters/count-dooku/", aliases: ["Dooku"], factions: ["Separatist", "Sith"] } as BotUnit,
    { name: "Hondo Ohnaka", uniqueName: "HONDO", side: "dark", url: "https://swgoh.gg/characters/hondo-ohnaka/", aliases: ["Hondo"], factions: ["Scoundrel"] } as BotUnit,
    // Base vs GL versions
    { name: "Rey", uniqueName: "REY", side: "light", url: "https://swgoh.gg/characters/rey/", aliases: ["Rey Jedi Training"], factions: ["Resistance", "Jedi"] } as BotUnit,
    // Ships crew
    { name: "Mace Windu", uniqueName: "MACEWINDU", side: "light", url: "https://swgoh.gg/characters/mace-windu/", aliases: ["Mace"], factions: ["Jedi", "Galactic Republic"] } as BotUnit,
    { name: "Asajj Ventress", uniqueName: "ASAJJVENTRESS", side: "dark", url: "https://swgoh.gg/characters/asajj-ventress/", aliases: ["Ventress"], factions: ["Separatist", "Nightsister"] } as BotUnit,
];

// Deep merge utility for combining objects
function deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    // If source is not an object, return it (primitives, functions, arrays)
    if (typeof source !== "object" || source === null || Array.isArray(source)) {
        return source;
    }

    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key]) && typeof target[key] === "object" && target[key] !== null && !Array.isArray(target[key])) {
            // Both are objects, merge recursively
            result[key] = deepMerge(target[key], source[key]);
        } else {
            // Otherwise, use source value (includes arrays)
            result[key] = source[key];
        }
    }
    return result;
}

// Mock character farm locations
const mockCharLocs = [
    {
        name: "Commander Luke Skywalker",
        defId: "COMMANDERLUKESKYWALKER",
        locations: [
            {
                type: "Journey Guide",
                name: "Hero's Journey: Commander Luke Skywalker",
                locId: "EVENT_HERO_CLS"
            }
        ]
    },
    {
        name: "Darth Vader",
        defId: "DARTHVADER",
        locations: [
            {
                type: "Hard Modes (D)",
                level: "1-A",
                locId: "HARD_DARK"
            },
            {
                type: "Fleet Arena Store",
                cost: "400/shard"
            }
        ]
    }
];

// Mock ship farm locations
const mockShipLocs = [
    {
        name: "Hound's Tooth",
        defId: "HOUNDSTOOTH",
        locations: [
            {
                type: "Hard Modes (Fleet)",
                level: "2-D",
                locId: "HARD_FLEET"
            }
        ]
    }
];

// Mock ship data
const mockShips: BotUnit[] = [
    { name: "Ahsoka Tano's Jedi Starfighter", uniqueName: "JEDISTARFIGHTERAHSOKATANO", side: "light", url: "http://swgoh.gg/ships/ahsoka-tanos-jedi-starfighter/", aliases: ["Ahsoka"], factions: ["Galactic Republic", "Jedi"] } as BotUnit,
    { name: "Tie Silencer", uniqueName: "TIESILENCER", side: "dark", url: "http://swgoh.gg/ships/tie-silencer/", aliases: ["Silencer"], factions: ["First Order"] } as BotUnit,
    { name: "Han's Millennium Falcon", uniqueName: "HANSFALCON", side: "light", url: "http://swgoh.gg/ships/hans-millennium-falcon/", aliases: ["Han Falcon"], factions: ["Rebel", "Scoundrel"] } as BotUnit,
    { name: "Hound's Tooth", uniqueName: "HOUNDSTOOTH", side: "dark", url: "http://swgoh.gg/ships/hounds-tooth/", aliases: ["HT"], factions: ["Scoundrel"] } as BotUnit,
    { name: "Xanadu Blood", uniqueName: "XANADUBLOOD", side: "dark", url: "http://swgoh.gg/ships/xanadu-blood/", aliases: [], factions: ["Separatist"] } as BotUnit,
    { name: "Rebel Y-Wing", uniqueName: "REBELY-WING", side: "light", url: "http://swgoh.gg/ships/rebel-y-wing/", aliases: ["Y-Wing"], factions: ["Rebel"] } as BotUnit,
    { name: "Slave I", uniqueName: "SLAVE1", side: "dark", url: "http://swgoh.gg/ships/slave-i/", aliases: ["Slave 1"], factions: ["Scoundrel", "Bounty Hunter"] } as BotUnit,
    { name: "Gauntlet Starfighter", uniqueName: "GAUNTLETSTARFIGHTER", side: "dark", url: "http://swgoh.gg/ships/gauntlet-starfighter/", aliases: [], factions: ["Mandalorian"] } as BotUnit,
];

/**
 * Creates a comprehensive mock Bot object for testing.
 *
 * Includes realistic sample data for characters, ships, and game data.
 * All properties can be overridden via the overrides parameter using deep merge.
 *
 * @param overrides - Partial BotType to override defaults. Nested objects are merged recursively.
 * @returns Fully typed BotType mock with comprehensive test data
 *
 * @example
 * // Basic usage
 * const bot = createMockBot();
 *
 * @example
 * // Override specific properties
 * const bot = createMockBot({
 *   shardId: 2,
 *   config: { mongodb: { swgohbotdb: "testdb" } }
 * });
 *
 * @example
 * // Override cache behavior
 * const bot = createMockBot({
 *   cache: {
 *     get: async () => [{ custom: "data" }]
 *   }
 * });
 */
export function createMockBot(overrides: Partial<BotType> = {}): BotType {
    // Stateful cache storage: Map<db.collection, Map<key, data>>
    const cacheStorage = new Map<string, Map<string, any>>();

    const getCollection = (db: string, col: string): Map<string, any> => {
        const collectionKey = `${db}.${col}`;
        if (!cacheStorage.has(collectionKey)) {
            cacheStorage.set(collectionKey, new Map());
        }
        return cacheStorage.get(collectionKey)!;
    };

    const matchesCondition = (item: any, match: any): boolean => {
        if (!match || typeof match !== "object") return true;
        for (const [key, value] of Object.entries(match)) {
            if (item[key] !== value) return false;
        }
        return true;
    };

    const applyProjection = (item: any, projection: any): any => {
        if (!projection || typeof projection !== "object") return item;
        const result: any = {};
        for (const [key, include] of Object.entries(projection)) {
            if (include) {
                result[key] = item[key];
            }
        }
        return Object.keys(result).length > 0 ? result : item;
    };

    const bot: BotType = {
        acronyms: {
            "CLS": "Commander Luke Skywalker",
            "TB": "Territory Battle",
            "SEE": "Sith Eternal Emperor",
            "SLKR": "Supreme Leader Kylo Ren",
            "JKL": "Jedi Knight Luke",
            "JKR": "Jedi Knight Revan",
            "GMY": "Grand Master Yoda",
        },
        factions: factions,
        missions: missions,
        resources: resources,
        abilityCosts: abilityCosts,
        help: {
            "General": {
                "info": { name: "info", description: "Shows bot info and stats" },
                "help": { name: "help", description: "Shows available commands" },
            },
            "Characters": {
                "character": { name: "character", description: "Show character info" },
                "stats": { name: "stats", description: "Show character stats" },
            },
        },
        omicrons: {
            tw: ["COMMANDERLUKESKYWALKER_UNIQUE02", "NEIBIT_UNIQUE01"],
            ga3: ["THIRDSISTER_UNIQUE01"],
            ga: ["HONDO_SPECIAL01"],
            tb: ["CASSIANANDOR_UNIQUE02", "FINN_UNIQUE02"],
            raid: ["BOUSHHPRINCELEIABOUSHH_UNIQUE01"],
            conquest: [],
            other: [],
        },
        sortOmicrons: async () => ({
            tw: ["COMMANDERLUKESKYWALKER_UNIQUE02", "NEIBIT_UNIQUE01"],
            ga3: ["THIRDSISTER_UNIQUE01"],
            ga: ["HONDO_SPECIAL01"],
            tb: ["CASSIANANDOR_UNIQUE02", "FINN_UNIQUE02"],
            raid: ["BOUSHHPRINCELEIABOUSHH_UNIQUE01"],
            conquest: [],
            other: [],
        }),
        cache: {
            get: async (db: string, col: string, match: any, projection: any = null, limit: number = 0) => {
                const collection = getCollection(db, col);
                const results: any[] = [];
                for (const item of collection.values()) {
                    if (matchesCondition(item, match)) {
                        results.push(applyProjection(item, projection));
                        if (limit > 0 && results.length >= limit) break;
                    }
                }
                return results;
            },
            getOne: async (db: string, col: string, match: any, projection: any = null) => {
                const collection = getCollection(db, col);
                for (const item of collection.values()) {
                    if (matchesCondition(item, match)) {
                        return applyProjection(item, projection);
                    }
                }
                return null;
            },
            put: async (db: string, col: string, match: any, obj: any, autoUpdate: boolean = true) => {
                const collection = getCollection(db, col);
                // Generate a key from the match condition or use a unique property
                const key = match?.id || match?._id || JSON.stringify(match) || Math.random().toString();
                collection.set(key, { ...match, ...obj });
                return obj;
            },
            putMany: async (db: string, col: string, arr: any[]) => {
                const collection = getCollection(db, col);
                for (const item of arr) {
                    const key = item.id || item._id || JSON.stringify(item) || Math.random().toString();
                    collection.set(key, item);
                }
                return arr;
            },
            remove: async (db: string, col: string, match: any) => {
                const collection = getCollection(db, col);
                const keysToRemove: string[] = [];
                for (const [key, item] of collection.entries()) {
                    if (matchesCondition(item, match)) {
                        keysToRemove.push(key);
                    }
                }
                for (const key of keysToRemove) {
                    collection.delete(key);
                }
                return keysToRemove.length;
            },
            exists: async (db: string, col: string, match: any) => {
                const collection = getCollection(db, col);
                for (const item of collection.values()) {
                    if (matchesCondition(item, match)) {
                        return true;
                    }
                }
                return false;
            },
        },
        config: {
           mongodb: {
                swgohbotdb: "test_swgohbotdb",
            }
        },
        constants: constants,
        logger: {
            log: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
        },
        mongo: {
            db: (dbName: string) => ({
                collection: (collectionName: string) => ({
                    estimatedDocumentCount: async () => {
                        // Return mock counts for common collections
                        if (collectionName === "playerStats") return 150000;
                        if (collectionName === "guilds") return 12000;
                        return 1000;
                    },
                    find: () => ({
                        toArray: async () => [],
                    }),
                    findOne: async () => null,
                    insertOne: async (doc: any) => ({ insertedId: "mock-id" }),
                    updateOne: async () => ({ modifiedCount: 1 }),
                    deleteOne: async () => ({ deletedCount: 1 }),
                }),
            }),
        } as any,
        shardId: 0,
        socket: null,
        journeyReqs: journeyReqs,
        journeyNames: Object.keys(journeyReqs),
        languages: {},
        commandList: ["info", "character", "guild", "events", "stats", "help"],
        getCurrentWeekday: (tz?: string) => (tz ? "Monday" : "Tuesday"),
        getSideColor: getSideColor,
        getPatronUser: async (discordID: string) => ({ discordID, amount_cents: 0 }),
        eventFuncs: {
            init: (client: any) => {},
            manageEvents: async (eventList: any[]) => {},
            getNextEvent: async (guildId: string) => null,
            scheduleEvent: async (guildId: string, event: any) => {},
        },
        patreonFuncs: {
            init: (client: any) => {},
            getPatronUser: async (userId: string) => ({ discordID: userId, amount_cents: 0 }),
            getUserLevel: async (userId: string) => 0,
        },
        swgohAPI: {
            getCharacter: async (uniqueName: string, language: string) => {
                if (uniqueName === "COMMANDERLUKESKYWALKER") {
                    return {
                        name: "Commander Luke Skywalker",
                        factions: ["Rebel", "Jedi"],
                        skillReferenceList: [
                            {
                                skillId: "basicskill_COMMANDERLUKESKYWALKER01",
                                name: "Call to Action",
                                desc: "Deal Physical damage to target enemy and grant all allies Critical Chance Up for 2 turns.",
                                cooldown: 0,
                                cost: {
                                    AbilityMatMk3: 20,
                                    AbilityMatOmega: 0,
                                    AbilityMatZeta: 0,
                                    AbilityMatOmicron: 0,
                                },
                            },
                            {
                                skillId: "uniqueskill_COMMANDERLUKESKYWALKER02",
                                name: "Learn Control",
                                desc: "Luke has +40% Potency and +40% Tenacity. **At the start of battle, Luke gains Foresight for 2 turns. Rebel and Jedi allies gain 5% Turn Meter whenever they Evade.**",
                                zetaDesc: "At the start of battle, Luke gains Foresight for 2 turns. Rebel and Jedi allies gain 5% Turn Meter whenever they Evade.",
                                cooldown: 0,
                                cost: {
                                    AbilityMatMk3: 35,
                                    AbilityMatOmega: 5,
                                    AbilityMatZeta: 1,
                                    AbilityMatOmicron: 0,
                                },
                            },
                        ],
                    };
                }
                return {
                    name: "Mock Character",
                    factions: [],
                    skillReferenceList: [],
                };
            },
            units: async (defId?: string, language: string = "eng_us") => {
                // If defId is provided, return specific unit; otherwise return all
                if (defId) {
                    const unit = [...mockCharacters, ...mockShips].find(u => u.uniqueName === defId);
                    return unit || null;
                }
                // Return all characters + ships
                return [...mockCharacters, ...mockShips];
            },
            getPlayer: async (allyCode: string, language: string) => {
                return {
                    name: "MockPlayer",
                    allyCode: allyCode,
                    level: 85,
                    roster: [
                        {
                            defId: "COMMANDERLUKESKYWALKER",
                            nameKey: "Commander Luke Skywalker",
                            rarity: 7,
                            level: 85,
                            gear: 13,
                            relic: { currentTier: 7 },
                        },
                        {
                            defId: "DARTHVADER",
                            nameKey: "Darth Vader",
                            rarity: 7,
                            level: 85,
                            gear: 13,
                            relic: { currentTier: 5 },
                        },
                    ],
                    arena: {
                        char: { rank: 50 },
                        ship: { rank: 100 },
                    },
                };
            },
            getGuild: async (allyCode: string, language: string) => {
                return {
                    name: "Mock Guild",
                    id: "guild123",
                    gp: 250000000,
                    roster: [
                        { name: "Player1", allyCode: "123456789", gp: 5000000 },
                        { name: "Player2", allyCode: "987654321", gp: 4500000 },
                        { name: "Player3", allyCode: "111222333", gp: 4800000 },
                    ],
                };
            },
            unitSearch: async (searchString: string, language: string) => {
                // Simple name/alias matching
                const allUnits = [...mockCharacters, ...mockShips];
                const search = searchString.toLowerCase();
                return allUnits.filter((unit) => {
                    const nameMatch = unit.name.toLowerCase().includes(search);
                    const aliasMatch = unit.aliases?.some((alias) => alias.toLowerCase().includes(search));
                    const uniqueMatch = unit.uniqueName.toLowerCase().includes(search);
                    return nameMatch || aliasMatch || uniqueMatch;
                });
            },
        },
        userReg: {
            getUser: () => ({
                id: "123",
                accounts: [],
                default: {},
                arenaAlert: {
                    enableRankDMs: false,
                    arena: "both",
                    payoutWarning: 10,
                    enablePayoutResult: true
                },
            }),
        },
        guildCount: async () => 150,
        userCount: async () => 1000,
        deployCommands: async (force?: boolean) => {
            const count = force ? 25 : 20;
            return `Deployed ${count} commands`;
        },
        getDefaultGuildSettings: () => defaultSettings,
        sendWebhook: (webhookURL: string, data: object) => {
            // No-op for testing
        },
    };

    return deepMerge(bot, overrides) as BotType;
}
