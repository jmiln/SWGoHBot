import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { type Client } from "discord.js";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import { PatreonFuncs, buildRankSnapshot, shouldWriteHistory, updateArenaHistory, collectAllyCodes, hydrateWatchAccounts } from "../../modules/patreonFuncs.ts";
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
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

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

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

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

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

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
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, firstRun, buildRankSnapshot(arenaPlayerMap));
            assert.ok(firstRun.has(888777666), "first run changed the doc, so it must be marked changed");
            assert.ok(arenaPlayerMap.has(888777666), "new doc must land in the map so the flush can find it");

            // Second run with identical data: ranks unchanged, history inside the 5-minute
            // dedup window => nothing changed, nothing should be marked changed.
            const secondRun = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, secondRun, buildRankSnapshot(arenaPlayerMap));
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
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "NewName");
            assert.ok(changedCodes.has(888777666), "a rename must mark the doc changed");
        });

        it("sends a rank drop DM to every patron registered to the same account", async () => {
            const patron1: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            const patron2: ActivePatron = { discordID: "hist_test_user2", amount_cents: 100 };
            const mkUser = (id: string) =>
                ({
                    id,
                    accounts: [888777666],
                    primaryAllyCode: 888777666,
                    arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
                }) as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "SharedDrop",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 => a drop both patrons should hear about
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "SharedDrop", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const rankSnapshot = buildRankSnapshot(arenaPlayerMap);

            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron1, mkUser("hist_test_user"), playerMap, arenaPlayerMap, changedCodes, rankSnapshot);
            await (patreonFuncs as any).processArenaAlerts(patron2, mkUser("hist_test_user2"), playerMap, arenaPlayerMap, changedCodes, rankSnapshot);

            assert.strictEqual(sentDMs.length, 2, "both patrons must get the rank drop DM, not just whoever is processed first");
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

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "KeepMe");
        });
    });

    describe("processShardPatron()", () => {
        beforeEach(async () => {
            await client.db(testDbName).collection("users").deleteMany({ id: { $in: ["shard_test_user", "shard_test_user2"] } }).catch(() => {});
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 }).catch(() => {});
        });

        it("keeps the stored doc name when the API name is empty", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Payout-only config: hasPayouts true, hasAlerts false => no broadcastEval send paths,
            // and aw.arena.char.enabled false keeps checkRanks() out of the picture.
            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
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

            // Post-migration state: the name lives on the arenaPlayers doc, not the watch entry
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "Stored" }],
            ]);
            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "the doc should still be in the map");
            assert.strictEqual(doc.name, "Stored", "an empty API name must not clobber the stored name");
            assert.strictEqual(doc.lastCharRank, 5);
            assert.ok(changedCodes.has(888777666), "the rank change must mark the doc changed");
        });

        it("does not write the user doc when no poOffset changed", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // poOffset already matches the API value, so the user doc has nothing to update
            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
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
                    name: "NoWrite",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // The user doc was intentionally never inserted — an unconditional updateUser would upsert it
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            const written = await client.db(testDbName).collection("users").findOne({ id: "shard_test_user" });
            assert.strictEqual(written, null, "the user doc must not be written when nothing in it changed");
        });

        it("writes the user doc when a poOffset changed", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
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
                    name: "OffsetMoved",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 120,
                }],
            ]);

            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            const written = await client.db(testDbName).collection("users").findOne({ id: "shard_test_user" });
            assert.ok(written, "the user doc must be written when a poOffset changed");
            assert.strictEqual(written.arenaWatch.allyCodes[0].poOffset, 120);
        });

        it("keeps over-limit watch entries in the user doc when writing back", async () => {
            // Tier 1 only processes the first entry, but the rest must stay stored so they
            // come back into play if the patron raises their tier
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [
                        { allyCode: 888777666, mention: null, poOffset: 0 },
                        { allyCode: 888777667, mention: null, poOffset: 60 },
                        { allyCode: 888777668, mention: null, poOffset: 120 },
                    ],
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

            // poOffset change on the processed entry forces the user-doc write
            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "KeepRest",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 30,
                }],
            ]);

            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            const written = await client.db(testDbName).collection("users").findOne({ id: "shard_test_user" });
            assert.ok(written, "the poOffset change must trigger a write");
            assert.strictEqual(written.arenaWatch.allyCodes.length, 3, "over-limit watch entries must not be dropped");
            assert.strictEqual(written.arenaWatch.allyCodes[0].poOffset, 30);
            assert.strictEqual(written.arenaWatch.allyCodes[1].poOffset, 60, "unprocessed entries must be untouched");
            assert.strictEqual(written.arenaWatch.allyCodes[2].poOffset, 120, "unprocessed entries must be untouched");
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
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "the existing doc must remain in the map");
            assert.strictEqual(doc.name, "NewApiName", "the persisted name must be refreshed to the new API name");
            assert.ok(changedCodes.has(888777666), "a name refresh must mark the doc changed");
        });
    });

    describe("arenaTick consumer ordering", () => {
        beforeEach(async () => {
            sentDMs.length = 0;
            await client.db(testDbName).collection("users").deleteMany({ id: "ordering_test_user" }).catch(() => {});
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 }).catch(() => {});
        });

        it("still detects a watch rank change after processArenaAlerts already updated the shared doc", async () => {
            const patron: ActivePatron = { discordID: "ordering_test_user", amount_cents: 500 };

            // The same account is both registered (accounts) and watched (arenaWatch) —
            // payout-only watch config keeps broadcastEval send paths out of the picture
            const user = {
                id: "ordering_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
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
                    name: "OrderingTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 — both consumers must see this change
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OrderingTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const rankSnapshot = buildRankSnapshot(arenaPlayerMap);

            const changedCodes = new Set<number>();
            // Same order as arenaTick: alerts first, then the watch/shard pass
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot);
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot);

            const doc = arenaPlayerMap.get(888777666);
            assert.strictEqual(doc?.lastCharRank, 10, "doc should hold the current rank");
            assert.strictEqual(doc?.lastCharChange, -5, "watch pass must compute the change from the tick-start rank, not the already-updated doc");
        });
    });

    describe("recordHistoryAtPayout()", () => {
        it("does not write an entry when the rank is nullish at payout", () => {
            // A watched ship-only (or char-only) account has no rank for the other arena —
            // an entry of { rank: null } must never land in the history
            const fromUndefined = (patreonFuncs as any).recordHistoryAtPayout(undefined, undefined, 0);
            assert.strictEqual(fromUndefined, undefined, "no entry should be created for an undefined rank");

            const existing = [{ rank: 5, ts: 1000 }];
            const fromNull = (patreonFuncs as any).recordHistoryAtPayout(existing, null, 0);
            assert.strictEqual(fromNull, existing, "history must be returned unchanged for a null rank");
        });

        it("still writes an entry for a real rank at payout", () => {
            const result = (patreonFuncs as any).recordHistoryAtPayout(undefined, 12, 0);
            assert.strictEqual(result?.length, 1);
            assert.strictEqual(result?.[0].rank, 12);
        });
    });

    describe("processShardPatron() at payout minute", () => {
        const PO_ALLY_CODE = 888777666;

        beforeEach(async () => {
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: PO_ALLY_CODE });
        });

        it("does not record a charHist entry when the account has no char rank", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Compute a poOffset that puts the char payout (~18h offset) ~30s from now,
            // so charMinLeft === 0 inside processShardPatron. Fractional offsets are fine.
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 30000) / 60000;

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: PO_ALLY_CODE, mention: null, poOffset }],
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

            // Ship-only account: char rank is null and there is no stored doc
            const playerMap = new Map<number, PlayerArenaRes>([
                [PO_ALLY_CODE, {
                    name: "ShipOnly",
                    allyCode: PO_ALLY_CODE,
                    arena: { char: { rank: null }, ship: { rank: 5 } },
                    poUTCOffsetMinutes: poOffset,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(PO_ALLY_CODE);
            assert.ok(doc, "a stub doc should exist for the watched account");
            assert.strictEqual(doc.charHist, undefined, `no charHist entry should be written, got: ${JSON.stringify(doc.charHist)}`);
        });
    });

    describe("processShardPatron() alert log output", () => {
        const LOG_ALLY_CODE = 888777666;
        let logFuncs: PatreonFuncs;
        let sentLogs: string[];

        before(() => {
            sentLogs = [];
            const fakeChannel = {
                id: "aw-chan",
                type: 0,
                guild: {},
                permissionsFor: () => ({ has: () => true }),
                send: async (payload: string) => {
                    sentLogs.push(payload);
                    return { id: "aw-msg-1" };
                },
            };
            const channelsCache = { get: (id: string) => (id === "aw-chan" ? fakeChannel : undefined) };
            const logClient = {
                user: { id: "bot123", username: "TestBot" },
                channels: { cache: channelsCache },
                shard: {
                    broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                        await fn({ channels: { cache: channelsCache }, user: { id: "bot123" } }, opts.context),
                    ],
                },
            } as unknown as Client<true>;
            logFuncs = new PatreonFuncs();
            logFuncs.init(logClient);
        });

        beforeEach(async () => {
            sentLogs.length = 0;
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: LOG_ALLY_CODE });
        });

        it("never renders 'undefined' as the player name when neither the doc nor the API has one", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Pin the char payout (~18h offset) ~30s from now so charMinLeft === 0 and the
            // payout-result line renders
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 30000) / 60000;

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    // Post-migration entry: no embedded name, payout-result reporting on
                    allyCodes: [{ allyCode: LOG_ALLY_CODE, mention: null, poOffset, result: "char" }],
                    arena: {
                        char: { channel: "aw-chan", enabled: true },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: false, channel: null, msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            // No arenaPlayers doc and an empty API name — worst case for name resolution
            const playerMap = new Map<number, PlayerArenaRes>([
                [LOG_ALLY_CODE, {
                    name: "",
                    allyCode: LOG_ALLY_CODE,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: poOffset,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (logFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.ok(sentLogs.length, "expected an alert log message to be sent");
            const logText = sentLogs.join("\n");
            assert.ok(!logText.includes("undefined"), `player name must never render as 'undefined': ${logText}`);
            assert.ok(logText.includes(String(LOG_ALLY_CODE)), `expected the ally code as the name fallback: ${logText}`);
        });
    });

    describe("formatPayouts()", () => {
        it("does not crash when a player has no stored rank and renders N/A", () => {
            const players = [
                {
                    allyCode: 777666555,
                    name: "NoRank",
                    mention: null,
                    poOffset: 0,
                    lastChar: null,
                    lastShip: null,
                    duration: 5,
                    timeTil: "5 minutes until payout.",
                },
            ] as unknown as ArenaWatchAcct[];

            const embed = (patreonFuncs as any).formatPayouts(players, "char");
            assert.ok(embed.fields.length, "expected a payout field");
            assert.ok(embed.fields[0].value.includes("N/A"), `expected N/A rank, got: ${embed.fields[0].value}`);
            assert.ok(embed.fields[0].value.includes("NoRank"), `expected player name, got: ${embed.fields[0].value}`);
        });
    });

    describe("shardTimes()", () => {
        const ST_ALLY_CODE = 777666555;
        const ST_USER_ID = "shardtimes_test_user";
        let stFuncs: PatreonFuncs;
        let sentPayloads: { embeds?: { fields?: { name: string; value: string }[] }[] }[];

        before(() => {
            sentPayloads = [];
            const fakeChannel = {
                id: "st-chan",
                type: 0,
                guild: {},
                permissionsFor: () => ({ has: () => true }),
                send: async (payload: (typeof sentPayloads)[number]) => {
                    sentPayloads.push(payload);
                    return { id: "st-msg-1" };
                },
            };
            const channelsCache = {
                get: (id: string) => (id === "st-chan" ? fakeChannel : undefined),
                find: (pred: (chan: typeof fakeChannel) => boolean) => (pred(fakeChannel) ? fakeChannel : undefined),
            };
            const stClient = {
                user: { id: "bot123", username: "TestBot" },
                channels: { cache: channelsCache },
                shard: {
                    broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                        await fn({ channels: { cache: channelsCache }, user: { id: "bot123" } }, opts.context),
                    ],
                },
            } as unknown as Client<true>;
            stFuncs = new PatreonFuncs();
            stFuncs.init(stClient);
        });

        beforeEach(async () => {
            sentPayloads.length = 0;
            await client.db(testDbName).collection("users").deleteMany({ id: ST_USER_ID });
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: ST_ALLY_CODE });
        });

        after(async () => {
            await client.db(testDbName).collection("users").deleteMany({ id: ST_USER_ID });
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: ST_ALLY_CODE });
        });

        it("sends a payout schedule hydrated with name and rank from the arenaPlayers collection", async () => {
            const patron: ActivePatron = { discordID: ST_USER_ID, amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: ST_USER_ID }, patron);

            const user = {
                id: ST_USER_ID,
                accounts: [],
                arenaWatch: {
                    // Post-migration shape: no name/lastChar/lastShip on the watch entry
                    allyCodes: [{ allyCode: ST_ALLY_CODE, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "st-chan", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;
            await cache.put(testDbName, "users", { id: ST_USER_ID }, user);

            await client
                .db(testDbName)
                .collection("arenaPlayers")
                .insertOne({ allyCode: ST_ALLY_CODE, name: "Hydrated", lastCharRank: 7, lastShipRank: 3 });

            await stFuncs.shardTimes();

            assert.strictEqual(sentPayloads.length, 1, "expected exactly one payout message");
            const field = sentPayloads[0]?.embeds?.[0]?.fields?.[0];
            assert.ok(field, "expected a payout field in the embed");
            assert.ok(field.value.includes("Hydrated"), `expected hydrated name, got: ${field.value}`);
            assert.ok(field.value.includes("7"), `expected hydrated char rank, got: ${field.value}`);
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

describe("hydrateWatchAccounts()", () => {
    it("merges name and ranks from arenaPlayers docs onto watch entries", () => {
        const entries = [{ allyCode: 111, mention: null, poOffset: 60 } as ArenaWatchConfig];
        const playerMap = new Map<number, ArenaPlayer>([
            [111, { allyCode: 111, name: "Merged", lastCharRank: 4, lastShipRank: 9 }],
        ]);
        const result = hydrateWatchAccounts(entries, playerMap);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, "Merged");
        assert.strictEqual(result[0].lastChar, 4);
        assert.strictEqual(result[0].lastShip, 9);
        assert.strictEqual(result[0].poOffset, 60);
    });

    it("falls back to the ally code as name and null ranks when no doc exists", () => {
        const entries = [{ allyCode: 222, mention: null, poOffset: 0 } as ArenaWatchConfig];
        const result = hydrateWatchAccounts(entries, new Map());
        assert.strictEqual(result[0].name, "222");
        assert.strictEqual(result[0].lastChar, null);
        assert.strictEqual(result[0].lastShip, null);
    });

    it("does not mutate the input entries", () => {
        const entry = { allyCode: 333, mention: null, poOffset: 0 } as ArenaWatchConfig;
        hydrateWatchAccounts([entry], new Map());
        assert.deepStrictEqual(entry, { allyCode: 333, mention: null, poOffset: 0 });
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

    it("only collects arenaWatch codes within the patron's tier account limit", () => {
        // $1 tier => arenaWatchConfig.tier1 (1) watched account; the rest are never
        // processed, so fetching their game data every tick is wasted work
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [],
                arenaWatch: {
                    allyCodes: [
                        { allyCode: 331, mention: null, poOffset: 0 },
                        { allyCode: 332, mention: null, poOffset: 0 },
                        { allyCode: 333, mention: null, poOffset: 0 },
                    ],
                },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.deepStrictEqual(result, [331], "codes past the tier limit must not be collected");
    });

    it("skips patrons with no user record in the map", () => {
        const patrons: ActivePatron[] = [{ discordID: "ghost", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>();
        assert.deepStrictEqual(collectAllyCodes(patrons, userMap), []);
    });
});
