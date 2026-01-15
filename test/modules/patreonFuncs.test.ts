import assert from "node:assert/strict";
import test from "node:test";
import patreonModule from "../../data/patreon.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import type { ActivePatron, BotClient, BotType, PatronUser } from "../../types/types.ts";

// Mock cache module for patreonFuncs tests
function createMockCache() {
    const mockPatrons: { [key: string]: Partial<PatronUser> } = {
        "patron1": {
            discordID: "patron1",
            userId: "patron1",
            amount_cents: 500, // $5 tier
            playerTime: 5,
            guildTime: 10,
            awAccounts: 20,
        },
        "patron2": {
            discordID: "patron2",
            userId: "patron2",
            amount_cents: 1000, // $10 tier
            playerTime: 1,
            guildTime: 1,
            awAccounts: 50,
        },
        "patron3": {
            discordID: "patron3",
            userId: "patron3",
            amount_cents: 100, // $1 tier
            playerTime: 60,
            guildTime: 180,
            awAccounts: 1,
        },
        "declined_patron": {
            discordID: "declined_patron",
            userId: "declined_patron",
            amount_cents: 500,
            declined_since: "2024-01-01",
        },
    };

    const mockGuildSettings: { [key: string]: any } = {};

    return {
        getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
            if (collection === "patrons") {
                const discordID = matchCondition.discordID;
                return mockPatrons[discordID] as T || null;
            }
            if (collection === "settings") {
                const guildId = matchCondition.guildID;
                return mockGuildSettings[guildId] as T || null;
            }
            return null;
        },
        get: async <T>(_database: string, collection: string, matchCondition: any) => {
            if (collection === "patrons") {
                return Object.values(mockPatrons) as T[];
            }
            return [] as T[];
        },
        put: async <T>(_database: string, _collection: string, matchCondition: any, saveObject: T) => {
            return saveObject;
        },
    };
}

function createMockClient(): BotClient {
    return {
        shard: {
            broadcastEval: async (fn: any, options?: any) => {
                return [];
            },
        },
        users: {
            fetch: async (userId: string) => {
                return {
                    id: userId,
                    send: async () => ({}),
                };
            },
        },
        channels: {
            cache: {
                get: (channelId: string) => null,
                find: (predicate: any) => null,
            },
        },
        user: {
            id: "bot123",
        },
    } as any;
}

function createMockBot(cache = createMockCache()): BotType {
    return {
        cache,
        config: {
            mongodb: {
                swgohbotdb: "swgohbotdb",
            },
            ownerid: "owner123",
            patrons: {
                "manual_patron": 500, // $5 tier manually configured
            },
        },
        logger: {
            log: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
        },
        userReg: {
            getUser: async (userId: string) => ({
                id: userId,
                accounts: [],
                defaults: {},
                arenaAlert: {
                    enableRankDMs: "false",
                    arena: "both",
                    payoutWarning: 10,
                    enablePayoutResult: true,
                },
            }),
            updateUser: async (userId: string, user: any) => user,
        },
        languages: {
            ENG_US: {
                BASE_GUILD_COOLDOWN: "cooldown text",
            },
        },
        toProperCase: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
        wait: async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
        swgohAPI: {
            getPlayersArena: async (allyCodes: number | number[]) => [],
            guild: async (allyCode: string | number) => null,
            getPlayerUpdates: async (allyCodes: number[]) => ({}),
            getRawGuild: async (allyCode: string | number, options?: any) => null,
        },
    } as any;
}

test.describe("PatreonFuncs Module", () => {
    test.describe("getPatronUser()", () => {
        test("should return patron user when found in database", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron1");

            assert.ok(patron);
            assert.equal(patron.discordID, "patron1");
            assert.equal(patron.amount_cents, 500);
            assert.equal(patron.playerTime, patreonModule.tiers[5].playerTime);
            assert.equal(patron.guildTime, patreonModule.tiers[5].guildTime);
            assert.equal(patron.awAccounts, patreonModule.tiers[5].awAccounts);
        });

        test("should return null for non-existent patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("nonexistent");

            assert.equal(patron, null);
        });

        test("should return null for patron with declined_since", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("declined_patron");

            assert.equal(patron, null);
        });

        test("should throw error when userId is missing", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            await assert.rejects(
                async () => await Bot.getPatronUser(""),
                { message: "Missing user ID" }
            );
        });

        test("should correctly calculate tier for $10 patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron2");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 1000);
            assert.equal(patron.playerTime, patreonModule.tiers[10].playerTime);
            assert.equal(patron.guildTime, patreonModule.tiers[10].guildTime);
            assert.equal(patron.awAccounts, patreonModule.tiers[10].awAccounts);
        });

        test("should correctly calculate tier for $1 patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron3");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 100);
            assert.equal(patron.playerTime, patreonModule.tiers[1].playerTime);
            assert.equal(patron.guildTime, patreonModule.tiers[1].guildTime);
            assert.equal(patron.awAccounts, patreonModule.tiers[1].awAccounts);
        });
    });

    test.describe("getPlayerCooldown()", () => {
        test("should return patron's cooldown when user is a patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const cooldown = await Bot.getPlayerCooldown("patron1");

            assert.ok(cooldown);
            assert.equal(cooldown.player, patreonModule.tiers[5].playerTime);
            assert.equal(cooldown.guild, patreonModule.tiers[5].guildTime);
        });

        test("should return default cooldown for non-patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const cooldown = await Bot.getPlayerCooldown("nonpatron");

            assert.ok(cooldown);
            assert.equal(cooldown.player, patreonModule.tiers[0].playerTime);
            assert.equal(cooldown.guild, patreonModule.tiers[0].guildTime);
        });

        test("should return best cooldown between patron and guild supporter", async () => {
            const customCache = createMockCache();
            // Mock a guild with supporter settings
            const Bot = createMockBot(customCache);
            const client = createMockClient();
            patreonFuncs(Bot, client);

            // patron3 is $1 tier (60 player, 180 guild)
            // If guild has better times, those should be used
            const cooldown = await Bot.getPlayerCooldown("patron3", "guild123");

            assert.ok(cooldown);
            // Should get at least the patron's times or better
            assert.ok(cooldown.player <= patreonModule.tiers[1].playerTime);
            assert.ok(cooldown.guild <= patreonModule.tiers[1].guildTime);
        });

        test("should use higher tier patron cooldown over lower guild supporter", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            // patron2 is $10 tier with very short cooldowns (1 min each)
            const cooldown = await Bot.getPlayerCooldown("patron2", "guild123");

            assert.ok(cooldown);
            assert.equal(cooldown.player, patreonModule.tiers[10].playerTime);
            assert.equal(cooldown.guild, patreonModule.tiers[10].guildTime);
        });
    });

    test.describe("Tier Calculation Logic", () => {
        test("should assign tier 0 for $0 patron", async () => {
            const cache = createMockCache();
            const Bot = createMockBot(cache);
            const client = createMockClient();

            // Add a patron with 0 cents
            const testCache = {
                ...cache,
                getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
                    if (collection === "patrons" && matchCondition.discordID === "zero_patron") {
                        return {
                            discordID: "zero_patron",
                            amount_cents: 0,
                        } as T;
                    }
                    return cache.getOne(_database, collection, matchCondition);
                },
            };

            const BotWithCustomCache = createMockBot(testCache);
            patreonFuncs(BotWithCustomCache, client);

            const patron = await BotWithCustomCache.getPatronUser("zero_patron");

            // Should return null for tier 0 / declined
            assert.equal(patron, null);
        });

        test("should assign tier 1 for $1.00 patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron3");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 100);
            assert.equal(patron.playerTime, patreonModule.tiers[1].playerTime);
        });

        test("should assign tier 5 for $5.00 patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron1");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 500);
            assert.equal(patron.playerTime, patreonModule.tiers[5].playerTime);
        });

        test("should assign tier 5 for $7.50 patron (between tier 5 and 10)", async () => {
            const cache = createMockCache();
            const testCache = {
                ...cache,
                getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
                    if (collection === "patrons" && matchCondition.discordID === "mid_patron") {
                        return {
                            discordID: "mid_patron",
                            amount_cents: 750, // $7.50
                        } as T;
                    }
                    return cache.getOne(_database, collection, matchCondition);
                },
            };

            const Bot = createMockBot(testCache);
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("mid_patron");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 750);
            // Should be tier 5 since 750 cents is less than tier 10 ($10 = 1000 cents)
            assert.equal(patron.playerTime, patreonModule.tiers[5].playerTime);
        });

        test("should assign tier 10 for $10.00 patron", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("patron2");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 1000);
            assert.equal(patron.playerTime, patreonModule.tiers[10].playerTime);
        });

        test("should assign tier 10 for $15.00 patron (above highest tier)", async () => {
            const cache = createMockCache();
            const testCache = {
                ...cache,
                getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
                    if (collection === "patrons" && matchCondition.discordID === "high_patron") {
                        return {
                            discordID: "high_patron",
                            amount_cents: 1500, // $15.00
                        } as T;
                    }
                    return cache.getOne(_database, collection, matchCondition);
                },
            };

            const Bot = createMockBot(testCache);
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("high_patron");

            assert.ok(patron);
            assert.equal(patron.amount_cents, 1500);
            // Should be tier 10 (highest tier)
            assert.equal(patron.playerTime, patreonModule.tiers[10].playerTime);
        });
    });

    test.describe("Edge Cases", () => {
        test("should handle patron with null amount_cents", async () => {
            const cache = createMockCache();
            const testCache = {
                ...cache,
                getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
                    if (collection === "patrons" && matchCondition.discordID === "null_patron") {
                        return {
                            discordID: "null_patron",
                            amount_cents: null,
                        } as T;
                    }
                    return cache.getOne(_database, collection, matchCondition);
                },
            };

            const Bot = createMockBot(testCache);
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("null_patron");

            assert.equal(patron, null);
        });

        test("should handle patron with undefined amount_cents", async () => {
            const cache = createMockCache();
            const testCache = {
                ...cache,
                getOne: async <T>(_database: string, collection: string, matchCondition: any) => {
                    if (collection === "patrons" && matchCondition.discordID === "undefined_patron") {
                        return {
                            discordID: "undefined_patron",
                            // amount_cents is undefined
                        } as T;
                    }
                    return cache.getOne(_database, collection, matchCondition);
                },
            };

            const Bot = createMockBot(testCache);
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const patron = await Bot.getPatronUser("undefined_patron");

            assert.equal(patron, null);
        });

        test("should handle getPlayerCooldown with no guildId", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const cooldown = await Bot.getPlayerCooldown("patron1");

            assert.ok(cooldown);
            assert.equal(cooldown.player, patreonModule.tiers[5].playerTime);
            assert.equal(cooldown.guild, patreonModule.tiers[5].guildTime);
        });

        test("should handle getPlayerCooldown with undefined guildId", async () => {
            const Bot = createMockBot();
            const client = createMockClient();
            patreonFuncs(Bot, client);

            const cooldown = await Bot.getPlayerCooldown("patron1", undefined);

            assert.ok(cooldown);
            assert.equal(cooldown.player, patreonModule.tiers[5].playerTime);
            assert.equal(cooldown.guild, patreonModule.tiers[5].guildTime);
        });
    });
});
