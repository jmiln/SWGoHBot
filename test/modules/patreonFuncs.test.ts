import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { type Client } from "discord.js";
import { MongoClient } from "mongodb";
import config from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import { PatreonFuncs } from "../../modules/patreonFuncs.ts";
import type { PatronUser } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("PatreonFuncs Module", () => {
    let client: MongoClient;
    let patreonFuncs: PatreonFuncs;
    let mockClient: Client<true>;

    // This has to use the same database as name as the main bot, since that's what the patreonFuncs module uses
    const testDbName = config.mongodb.swgohbotdb;

    before(async () => {
        // Get shared MongoDB client from testcontainer
        client = await getMongoClient();

        cache.init(client);

        // Create mock Discord client
        mockClient = {
            user: { id: "bot123", username: "TestBot" },
            guilds: { cache: new Map() },
        } as any;

        patreonFuncs = new PatreonFuncs();
        patreonFuncs.init(mockClient);
    });

    after(async () => {
        try {
            await client.db(testDbName).dropDatabase();
        } catch (e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(async () => {
        // Clear patrons collection before each test
        try {
            await client.db(testDbName).collection("patrons").deleteMany({});
        } catch (e) {
            // Collection might not exist yet
        }
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

        it("filters out declined patrons", async () => {
            const patronData: PatronUser = {
                discordID: "declined",
                amount_cents: 500,
                userId: "declined",
                declined_since: new Date(),
            };

            await cache.put(testDbName, "patrons", { discordID: "declined" }, patronData);

            const result = await patreonFuncs.getPatronUser("declined");

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

        it("excludes declined patrons", async () => {
            const declinedPatron: PatronUser = {
                discordID: "declined_status",
                amount_cents: 500,
                userId: "declined_status",
                declined_since: new Date("2024-01-01"),
            };

            await cache.put(testDbName, "patrons", { discordID: "declined_status" }, declinedPatron);

            const result = await patreonFuncs.getPatronUser("declined_status");

            assert.strictEqual(result, null);
        });

        it("handles patron without declined_since field", async () => {
            const patron: PatronUser = {
                discordID: "no_declined",
                amount_cents: 500,
                userId: "no_declined",
            };

            await cache.put(testDbName, "patrons", { discordID: "no_declined" }, patron);

            const result = await patreonFuncs.getPatronUser("no_declined");

            assert.ok(result);
            assert.strictEqual(result.discordID, "no_declined");
        });
    });

    describe("edge cases", () => {
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
});
