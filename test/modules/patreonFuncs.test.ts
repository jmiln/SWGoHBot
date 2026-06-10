import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { type Client } from "discord.js";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import { PatreonFuncs, shouldWriteHistory, updateArenaHistory, collectAllyCodes } from "../../modules/patreonFuncs.ts";
import userReg from "../../modules/users.ts";
import Language from "../../base/Language.ts";
import { defaultSettings } from "../../data/constants/defaultGuildConf.ts";
import { createMockLanguage } from "../mocks/index.ts";
import type { ActivePatron, ArenaPlayer, ArenaWatchAcct, ArenaWatchConfig, PatronUser, PlayerArenaRes, UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("PatreonFuncs Module", () => {
    let client: MongoClient;
    let patreonFuncs: PatreonFuncs;
    let mockClient: Client<true>;
    let sentDMs: { embeds?: { description?: string }[] }[];

    // This has to use the same database as name as the main bot, since that's what the patreonFuncs module uses
    const testDbName = env.MONGODB_SWGOHBOT_DB;

    before(async () => {
        // Get shared MongoDB client from testcontainer
        client = await getMongoClient();

        cache.init(client);
        userReg.init(cache);
        arenaPlayerRegistry.init(cache);

        sentDMs = [];
        // Create mock Discord client
        mockClient = {
            user: { id: "bot123", username: "TestBot" },
            guilds: { cache: new Map() },
            users: {
                fetch: async () => ({
                    send: async (msg: { embeds?: { description?: string }[] }) => {
                        sentDMs.push(msg);
                        return msg;
                    },
                }),
            },
        } as unknown as Client<true>;

        // handleArenaAlerts() formats payout time via the default registered language
        Language.registerLanguage(defaultSettings.language, createMockLanguage());

        patreonFuncs = new PatreonFuncs();
        patreonFuncs.init(mockClient);
    });

    after(async () => {
        try {
            await client.db(testDbName).collection("patrons").deleteMany({});
        } catch (e) {
            // Ignore cleanup errors
        }
        await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: { $in: [888777666] } });
        await closeMongoClient();
    });

    beforeEach(async () => {
        // Clear patrons collection before each test
        try {
            await client.db(testDbName).collection("patrons").deleteMany({});
        } catch (e) {
            // Collection might not exist yet
        }
        await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: { $in: [888777666] } }).catch(() => {});
    });

    describe("init()", () => {
        it("initializes with Discord client", () => {
            const newPatreonFuncs = new PatreonFuncs();
            newPatreonFuncs.init(mockClient);
            // If no error thrown, initialization successful
            assert.ok(true);
        });
    });

    describe("getPatronUser()", () => {
        it("returns patron from database", async () => {
            const patronData: PatronUser = {
                discordID: "123",
                amount_cents: 500, // $5 tier
                userId: "123",
            };

            await cache.put(testDbName, "patrons", { discordID: "123" }, patronData);

            const result = await patreonFuncs.getPatronUser("123");

            assert.ok(result);
            assert.strictEqual(result.discordID, "123");
            assert.strictEqual(result.amount_cents, 500);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });

        it("returns null for non-existent patron", async () => {
            const result = await patreonFuncs.getPatronUser("nonexistent");

            assert.strictEqual(result, null);
        });


        it("throws error for missing user ID", async () => {
            await assert.rejects(async () => await patreonFuncs.getPatronUser(""), /Missing user ID/);
        });

        it("returns correct tier benefits for $1 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier1",
                amount_cents: 100, // $1
                userId: "tier1",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier1");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });

        it("returns correct tier benefits for $5 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier5",
                amount_cents: 500, // $5
                userId: "tier5",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier5" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier5");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });

        it("returns correct tier benefits for $10 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier10",
                amount_cents: 1000, // $10
                userId: "tier10",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier10" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier10");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });
    });

    describe("getPlayerCooldown()", () => {
        it("returns default cooldowns for non-patron", async () => {
            const cooldown = await patreonFuncs.getPlayerCooldown("nonpatron");

            assert.ok(cooldown);
            assert.ok(typeof cooldown.player === "number");
            assert.ok(typeof cooldown.guild === "number");
            assert.ok(cooldown.player > 0);
            assert.ok(cooldown.guild > 0);
        });

        it("returns reduced cooldowns for patron", async () => {
            const patronData: PatronUser = {
                discordID: "cooldown_patron",
                amount_cents: 500, // $5
                userId: "cooldown_patron",
            };

            await cache.put(testDbName, "patrons", { discordID: "cooldown_patron" }, patronData);

            const defaultCooldown = await patreonFuncs.getPlayerCooldown("nonpatron");
            const patronCooldown = await patreonFuncs.getPlayerCooldown("cooldown_patron");

            // Patron should have better (lower) cooldowns
            assert.ok(patronCooldown.player <= defaultCooldown.player);
            assert.ok(patronCooldown.guild <= defaultCooldown.guild);
        });

        it("returns best cooldown between patron and guild supporter", async () => {
            const cooldown = await patreonFuncs.getPlayerCooldown("user123", "guild456");

            assert.ok(cooldown);
            assert.ok(typeof cooldown.player === "number");
            assert.ok(typeof cooldown.guild === "number");
        });

        it("handles higher tier patron correctly", async () => {
            const tier1Patron: PatronUser = {
                discordID: "tier1_cooldown",
                amount_cents: 100, // $1
                userId: "tier1_cooldown",
            };

            const tier10Patron: PatronUser = {
                discordID: "tier10_cooldown",
                amount_cents: 1000, // $10
                userId: "tier10_cooldown",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1_cooldown" }, tier1Patron);
            await cache.put(testDbName, "patrons", { discordID: "tier10_cooldown" }, tier10Patron);

            const tier1Cooldown = await patreonFuncs.getPlayerCooldown("tier1_cooldown");
            const tier10Cooldown = await patreonFuncs.getPlayerCooldown("tier10_cooldown");

            // Higher tier should have better (lower or equal) cooldowns
            assert.ok(tier10Cooldown.player <= tier1Cooldown.player);
            assert.ok(tier10Cooldown.guild <= tier1Cooldown.guild);
        });
    });

    describe("tier calculation", () => {
        it("assigns tier 0 for $0", async () => {
            const patron: PatronUser = {
                discordID: "tier0",
                amount_cents: 0,
                userId: "tier0",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier0" }, patron);

            const result = await patreonFuncs.getPatronUser("tier0");

            // Should return null for declined/zero tier
            assert.strictEqual(result, null);
        });

        it("assigns tier 1 for $1-$4.99", async () => {
            const patron: PatronUser = {
                discordID: "tier1_range",
                amount_cents: 250, // $2.50
                userId: "tier1_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier1_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
        });

        it("assigns tier 5 for $5-$9.99", async () => {
            const patron: PatronUser = {
                discordID: "tier5_range",
                amount_cents: 750, // $7.50
                userId: "tier5_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier5_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier5_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });

        it("assigns tier 10 for $10+", async () => {
            const patron: PatronUser = {
                discordID: "tier10_range",
                amount_cents: 1500, // $15
                userId: "tier10_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier10_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier10_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });
    });

    describe("patron status filtering", () => {
        it("includes active patrons", async () => {
            const activePatron: PatronUser = {
                discordID: "active",
                amount_cents: 500,
                userId: "active",
            };

            await cache.put(testDbName, "patrons", { discordID: "active" }, activePatron);

            const result = await patreonFuncs.getPatronUser("active");

            assert.ok(result);
            assert.strictEqual(result.discordID, "active");
        });

    });

    describe("edge cases (patreon)", () => {
        it("handles patron with exactly $1", async () => {
            const patron: PatronUser = {
                discordID: "exactly_1",
                amount_cents: 100,
                userId: "exactly_1",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_1" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_1");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 100);
        });

        it("handles patron with exactly $5", async () => {
            const patron: PatronUser = {
                discordID: "exactly_5",
                amount_cents: 500,
                userId: "exactly_5",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_5" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_5");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 500);
        });

        it("handles patron with exactly $10", async () => {
            const patron: PatronUser = {
                discordID: "exactly_10",
                amount_cents: 1000,
                userId: "exactly_10",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_10" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_10");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 1000);
        });

        it("handles very high patron amount", async () => {
            const patron: PatronUser = {
                discordID: "whale",
                amount_cents: 10000, // $100
                userId: "whale",
            };

            await cache.put(testDbName, "patrons", { discordID: "whale" }, patron);

            const result = await patreonFuncs.getPatronUser("whale");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 10000);
            // Should get highest tier benefits
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });
    });

    describe("processArenaAlerts()", () => {
        beforeEach(async () => {
            sentDMs.length = 0;
            try {
                await client.db(testDbName).collection("users").deleteMany({ id: "hist_test_user" });
                await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 });
            } catch (e) {
                // ignore
            }
        });

        it("updates lastCharRank and lastShipRank in arenaPlayers for a patron with no arenaAlert config", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            // User has accounts but NO arenaAlert — history/rank tracking should still run
            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;
            await cache.put(testDbName, "users", { id: "hist_test_user" }, user);

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "HistPlayer",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: 15 } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>());

            // Flush arenaPlayerMap to DB (normally done by arenaTick)
            await arenaPlayerRegistry.batchUpsert([...arenaPlayerMap.values()]);

            const playerDoc = await client.db(testDbName).collection("arenaPlayers").findOne({ allyCode: 888777666 });
            assert.ok(playerDoc, "arenaPlayers doc should exist after processArenaAlerts");
            assert.strictEqual(playerDoc.lastCharRank, 42, "lastCharRank should be updated");
            assert.strictEqual(playerDoc.lastShipRank, 15, "lastShipRank should be updated");
        });

        it("sends a rank drop DM when the rank worsens since the stored rank", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "DropTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 => the player dropped and a DM should fire
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "DropTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>());

            assert.strictEqual(sentDMs.length, 1, "expected exactly one rank drop DM");
            const desc = sentDMs[0]?.embeds?.[0]?.description ?? "";
            assert.ok(desc.includes("dropped from 5 to **10**"), `unexpected DM description: ${desc}`);
        });

        it("advances climb tracking when the rank improves", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "ClimbTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 3 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "ClimbTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>());

            const doc = arenaPlayerMap.get(888777666);
            assert.strictEqual(doc?.lastCharRank, 3, "lastCharRank should track the new rank");
            assert.strictEqual(doc?.lastCharClimb, 3, "lastCharClimb should advance to the better rank");
            assert.strictEqual(sentDMs.length, 0, "an improvement must not send a drop DM");
        });

        it("adds changed ally codes to changedCodes and skips unchanged ones on a repeat run", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "ChangedTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: 15 } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            const firstRun = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, firstRun);
            assert.ok(firstRun.has(888777666), "first run changed the doc, so it must be marked changed");
            assert.ok(arenaPlayerMap.has(888777666), "new doc must land in the map so the flush can find it");

            // Second run with identical data: ranks unchanged, history inside the 5-minute
            // dedup window => nothing changed, nothing should be marked changed.
            const secondRun = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, secondRun);
            assert.strictEqual(secondRun.size, 0, "unchanged docs must not be marked changed");
        });

        it("refreshes the stored name when the API reports a rename", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NewName",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OldName", lastCharRank: 42, lastCharClimb: 42 }],
            ]);

            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes);

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "NewName");
            assert.ok(changedCodes.has(888777666), "a rename must mark the doc changed");
        });

        it("does not clobber the stored name with an empty API name", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "KeepMe", lastCharRank: 42, lastCharClimb: 42 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>());

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "KeepMe");
        });
    });

    describe("processShardPatron()", () => {
        beforeEach(async () => {
            await client.db(testDbName).collection("users").deleteMany({ id: { $in: ["shard_test_user", "shard_test_user2"] } }).catch(() => {});
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 }).catch(() => {});
        });

        it("falls back to the stored account name when the API name is empty", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Payout-only config: hasPayouts true, hasAlerts false => no broadcastEval send paths,
            // and aw.arena.char.enabled false keeps checkRanks() out of the picture.
            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, name: "Stored", mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes);

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "a stub doc should be created for the watched account");
            assert.strictEqual(doc.name, "Stored", "stub must use the stored name, not the empty API name");
            assert.strictEqual(doc.lastCharRank, 5);
            assert.ok(changedCodes.has(888777666), "the rank change must mark the stub changed");
        });

        it("refreshes the persisted name when the API name differs from an existing doc", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user2", amount_cents: 100 };

            const user = {
                id: "shard_test_user2",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, name: "Stored", mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NewApiName",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OldStoredName", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes);

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "the existing doc must remain in the map");
            assert.strictEqual(doc.name, "NewApiName", "the persisted name must be refreshed to the new API name");
            assert.ok(changedCodes.has(888777666), "a name refresh must mark the doc changed");
        });
    });

    describe("getTimeLeft()", () => {
        const dayMS = 1000 * 60 * 60 * 24;

        it("never returns a duration of a day or more, even when the raw target lands days in the future", () => {
            // offset -3240 + hrDiff 18h pushes the raw target ~3 days ahead of "now";
            // a correct implementation always normalizes the result back into [0, dayMS)
            const timeLeft = (patreonFuncs as any).getTimeLeft(-3240, 18);
            assert.ok(timeLeft >= 0 && timeLeft < dayMS, `Expected timeLeft within [0, dayMS), got ${timeLeft}`);
        });

        it("never returns a negative duration, even when the raw target lands days in the past", () => {
            // offset +3240 + hrDiff 18h pushes the raw target ~3 days behind "now";
            // a correct implementation always normalizes the result back into [0, dayMS)
            const timeLeft = (patreonFuncs as any).getTimeLeft(3240, 18);
            assert.ok(timeLeft >= 0 && timeLeft < dayMS, `Expected timeLeft within [0, dayMS), got ${timeLeft}`);
        });
    });
});

describe("updateArenaHistory()", () => {
    it("creates a new entry from undefined input", () => {
        const result = updateArenaHistory(undefined, 42);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].rank, 42);
        assert.ok(typeof result[0].ts === "number");
    });

    it("pushes a new entry onto an existing array", () => {
        const existing = [{ rank: 10, ts: 1000 }];
        const result = updateArenaHistory(existing, 8);
        assert.strictEqual(result.length, 2);
    });

    it("does not mutate the input array", () => {
        const existing = [{ rank: 10, ts: 1000 }];
        updateArenaHistory(existing, 8);
        assert.strictEqual(existing.length, 1);
    });

    it("sorts entries by timestamp ascending", () => {
        // existing entries have small ts values; new entry gets Date.now() which is far larger
        const existing = [
            { rank: 5, ts: 3000 },
            { rank: 3, ts: 1000 },
        ];
        const result = updateArenaHistory(existing, 7);
        assert.strictEqual(result.length, 3);
        assert.ok(result[0].ts <= result[1].ts);
        assert.ok(result[1].ts <= result[2].ts);
        assert.strictEqual(result[2].rank, 7); // new entry has largest ts so lands last
    });

    it("caps at 90 entries by shifting the oldest", () => {
        // ts values 1..90 are far in the past; new entry gets Date.now() so it lands last
        const existing = Array.from({ length: 90 }, (_, i) => ({ rank: i + 1, ts: i + 1 }));
        const result = updateArenaHistory(existing, 99);
        assert.strictEqual(result.length, 90);
        assert.ok(result.every((e) => e.ts !== 1)); // ts=1 (oldest) was shifted off
        assert.strictEqual(result[0].ts, 2); // ts=2 is now the oldest
        assert.ok(result.some((e) => e.rank === 99));
    });

    it("keeps 90 entries when input has exactly 89", () => {
        const existing = Array.from({ length: 89 }, (_, i) => ({ rank: i + 1, ts: i + 1 }));
        const result = updateArenaHistory(existing, 99);
        assert.strictEqual(result.length, 90);
    });

    it("handles an empty array input", () => {
        const result = updateArenaHistory([], 15);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].rank, 15);
    });
});

describe("shouldWriteHistory()", () => {
    it("returns true for undefined input (no history yet)", () => {
        assert.strictEqual(shouldWriteHistory(undefined), true);
    });

    it("returns true for empty array", () => {
        assert.strictEqual(shouldWriteHistory([]), true);
    });

    it("returns true when last entry is older than 5 minutes", () => {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        assert.strictEqual(shouldWriteHistory([{ rank: 5, ts: tenMinutesAgo }]), true);
    });

    it("returns false when last entry is within the 5-minute dedup window", () => {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        assert.strictEqual(shouldWriteHistory([{ rank: 5, ts: oneMinuteAgo }]), false);
    });

    it("reads the last entry (newest) not an arbitrary element", () => {
        // Array sorted ascending by ts: last element is newest.
        // If shouldWriteHistory correctly uses at(-1), it sees the recent entry and returns false.
        // If it used at(0) by mistake, it would see the old entry and return true.
        const old = { rank: 3, ts: 1 };
        const recent = { rank: 5, ts: Date.now() - 60 * 1000 };
        assert.strictEqual(shouldWriteHistory([old, recent]), false);
    });
});

describe("collectAllyCodes()", () => {
    it("returns empty array when no eligible patrons (below tier 1)", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 50 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", { id: "u1", accounts: [111], primaryAllyCode: 111 } as UserConfig],
        ]);
        assert.deepStrictEqual(collectAllyCodes(patrons, userMap), []);
    });

    it("collects ally codes from user.accounts for eligible patrons", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [111, 222],
                primaryAllyCode: 111,
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(111));
        assert.ok(result.includes(222));
    });

    it("collects ally codes from arenaWatch.allyCodes", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [],
                arenaWatch: { allyCodes: [{ allyCode: 333, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.ok(result.includes(333));
    });

    it("deduplicates a code that appears in both accounts and arenaWatch", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [111], primaryAllyCode: 111,
                arenaWatch: { allyCodes: [{ allyCode: 111, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.filter((c) => c === 111).length, 1);
    });

    it("deduplicates a code watched by two different patrons", () => {
        const patrons: ActivePatron[] = [
            { discordID: "u1", amount_cents: 100 },
            { discordID: "u2", amount_cents: 100 },
        ];
        const userMap = new Map<string, UserConfig>([
            ["u1", { id: "u1", accounts: [555], primaryAllyCode: 555 } as UserConfig],
            ["u2", { id: "u2", accounts: [], arenaWatch: { allyCodes: [{ allyCode: 555, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] } } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.filter((c) => c === 555).length, 1);
    });

    it("skips patrons with no user record in the map", () => {
        const patrons: ActivePatron[] = [{ discordID: "ghost", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>();
        assert.deepStrictEqual(collectAllyCodes(patrons, userMap), []);
    });
});
