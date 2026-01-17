import constants from "../../data/constants/constants.ts";
import { getSideColor } from "../../modules/functions.ts";
import type { BotClient, BotType } from "../../types/types.ts";

export function createMockBot(overrides: Partial<BotType> = {}): BotType {
    const bot: BotType = {
        acronyms: {
            "CLS": "Commander Luke Skywalker",
            "TB": "Territory Battle",
        },
        characters: [
            { name: "Commander Luke Skywalker", uniqueName: "COMMANDERLUKESKYWALKER", side: "light", url: "https://swgoh.gg/characters/commander-luke-skywalker/", aliases: ["CLS", "Luke"] },
            { name: "Darth Vader", uniqueName: "DARTHVADER", side: "dark", url: "https://swgoh.gg/characters/darth-vader/", aliases: ["Vader", "DV"] },
            { name: "Rey", uniqueName: "REY", side: "light", url: "https://swgoh.gg/characters/rey/", aliases: [] },
        ],
        cache: {
            get: async (args) => {
                return args;
            },
            getOne: async (args) => {
                return args;
            },
            put: async (database: string, collection: string, matchCondition: object, saveObject: Object, autoUpdate = true) => {
                return saveObject;
            }
        },
        config: {
           mongodb: {
                swgohbotdb: "swgohbotdb",
            }
        },
        constants: constants,
        logger: {
            log: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
        },
        getCurrentWeekday: (tz?: string) => (tz ? "Monday" : "Tuesday"),
        getSideColor: getSideColor,
        getPatronUser: async (discordID: string) => ({ discordID, amount_cents: 0 }),
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
    } as any;

    return {
        ...bot,
        ...overrides,
        cache: {
            ...bot.cache,
            ...(overrides.cache || {}),
        },
        userReg: {
            ...bot.userReg,
            ...(overrides.userReg || {}),
        },
    };
}
