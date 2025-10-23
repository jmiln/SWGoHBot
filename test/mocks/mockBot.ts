import type { BotType } from "../../types/types.ts";

export function createMockBot(overrides: Partial<BotType> = {}): BotType {
    const bot: BotType = {
        acronyms: {
            CLS: "Commander Luke Skywalker",
            TB: "Territory Battle",
            SLKR: "Supreme Leader Kylo Ren",
        },
        characters: [
            { name: "Commander Luke Skywalker", uniqueName: "COMMANDERLUKESKYWALKER" },
        ],
        cache: {
            get: async (args) => {
                return args;
            },
            put: async (database: string, collection: string, matchCondition: object, saveObject: Object, autoUpdate = true) => {
                return saveObject;
            }
        },
        getCurrentWeekday: (tz?: string) => (tz ? "Monday" : "Tuesday"),
        getPatronUser: async (discordID: string) => ({ discordID, amount_cents: 0 }),
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
        }
    } as any;

    return {
        ...bot,
        ...overrides,
        cache: {
            ...bot.cache,
            ...(overrides.cache || {}),
        }
    };
}
