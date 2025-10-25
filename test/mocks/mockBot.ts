import type { BotType } from "../../types/types.ts";

export function createMockBot(overrides: Partial<BotType> = {}): BotType {
    const bot: BotType = {
        acronyms: {
            CLS: "Commander Luke Skywalker",
            TB: "Territory Battle",
            SLKR: "Supreme Leader Kylo Ren",
        },
        arenaJumps: { "59":47, "50":39, "49":38, "48":38, "46":36, "42":32, "41":32, "40":32, "39":31, "38":30, "37":29, "36":28, "35":27, "34":26, "33":25, "32":25, "31":24, "30":23, "29":22, "28":21, "27":20, "26":19, "25":18, "24":18, "23":17, "22":16, "21":15, "20":14, "19":13, "18":13, "17":12, "16":11, "15":10, "14":9, "13":8, "12":8, "11":7, "10":6, "9":5, "8":4, "7":3, "6":2, "5":1, "4":1, "3":1, "2":1 },
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
        characters: [
            { name: "Commander Luke Skywalker", uniqueName: "COMMANDERLUKESKYWALKER" },
        ],
        config: {
           mongodb: {
                swgohbotdb: "swgohbotdb",
            }
        },
        constants: {
            colors: {
                black:     0,
                blue:      255,
                lightblue: 22015,
                green:     65280,
                red:       16711680,
                brightred: 14685204,
                white:     16777215,
                yellow:    16776960,
            }
        },
        getCurrentWeekday: (tz?: string) => (tz ? "Monday" : "Tuesday"),
        getPatronUser: async (discordID: string) => ({ discordID, amount_cents: 0 }),
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
        }
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
