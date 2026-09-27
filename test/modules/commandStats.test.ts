import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import type { ChatInputCommandInteraction } from "discord.js";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import indexConfig from "../../config/indexes.ts";
import { getCommandDetail, recordCommandUsage, STATS_WINDOW_MS, shutdown } from "../../modules/commandStats.ts";
import database from "../../modules/database.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("commandStats module", () => {
    let mongoClient: MongoClient;
    const db = () => mongoClient.db(env.MONGODB_SWGOHBOT_DB);
    const col = () => db().collection("commandStats");

    // Names unique to this file: test files run in parallel against the shared commandStats
    // collection, so cleanup must be scoped to these rather than dropping the collection.
    const CS_CMD_NAMES = ["mods", "mymods", "mycharacter", "notimed", "cs_recorded", "cs_subcommand", "cs_group", "cs_ttl"];

    before(async () => {
        mongoClient = await getMongoClient();
        database.init(mongoClient);

        // Seed test data
        const now = Date.now();
        await col().deleteMany({ commandName: { $in: CS_CMD_NAMES } });
        await col().insertMany([
            { commandName: "mods", subcommand: null, count: 10, success: true, executionTime: 200, createdAt: new Date(now) },
            { commandName: "mods", subcommand: null, count: 5, success: false, executionTime: 400, createdAt: new Date(now) },
            { commandName: "mods", subcommand: null, count: 3, success: true, executionTime: 100, createdAt: new Date(now) },
            { commandName: "mymods", subcommand: "best", count: 8, success: true, executionTime: 150, createdAt: new Date(now) },
            { commandName: "mymods", subcommand: "character", count: 4, success: true, executionTime: 120, createdAt: new Date(now) },
        ]);

        await col().insertMany([
            {
                commandName: "mycharacter",
                subcommand: "character",
                count: 1,
                success: true,
                createdAt: new Date(now),
                options: [
                    { name: "allycode", type: 3 },
                    { name: "compare", type: 5 },
                ],
            },
            {
                commandName: "mycharacter",
                subcommand: "character",
                count: 1,
                success: true,
                createdAt: new Date(now),
                options: [{ name: "allycode", type: 3 }],
            },
            {
                commandName: "mycharacter",
                subcommand: "ship",
                count: 1,
                success: true,
                createdAt: new Date(now),
                // no options field - should be excluded from argument aggregation
            },
            {
                commandName: "mycharacter",
                subcommand: "character",
                count: 3, // represents 3 executions
                success: true,
                createdAt: new Date(now),
                options: [{ name: "allycode", type: 3 }],
            },
        ]);
    });

    after(async () => {
        await col().deleteMany({ commandName: { $in: CS_CMD_NAMES } });
        await closeMongoClient();
    });

    describe("getCommandDetail()", () => {
        it("returns total count for a command", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mods", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 18); // 10 + 5 + 3
            assert.deepStrictEqual(result.subcommandCounts, {});
        });

        it("returns success rate", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mods", now - STATS_WINDOW_MS, now);
            // 13 successes / 18 total = 72.2... → Math.round → 72
            assert.strictEqual(result.successRate, 72);
        });

        it("returns subcommand counts when subcommands exist", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mymods", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 12); // 8 + 4
            assert.strictEqual(result.subcommandCounts.best, 8);
            assert.strictEqual(result.subcommandCounts.character, 4);
        });

        it("returns null avgExecutionTime when no timing data", async () => {
            // Insert a record with no executionTime
            const now = Date.now();
            await col().insertOne({ commandName: "notimed", count: 1, success: true, createdAt: new Date(now) });
            const result = await getCommandDetail("notimed", now - STATS_WINDOW_MS, now);
            assert.ok(result.totalCount >= 1);
            assert.strictEqual(result.avgExecutionTime, null);
        });

        it("returns zero totalCount for unknown command", async () => {
            const now = Date.now();
            const result = await getCommandDetail("doesnotexist", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.totalCount, 0);
            assert.strictEqual(result.successRate, 0);
            assert.strictEqual(result.avgExecutionTime, null);
            assert.deepStrictEqual(result.argumentUsage, {});
        });

        it("returns argument usage counts collapsed across all subcommands", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mycharacter", now - STATS_WINDOW_MS, now);
            assert.strictEqual(result.argumentUsage.allycode, 5);
            assert.strictEqual(result.argumentUsage.compare, 1);
            assert.strictEqual(Object.keys(result.argumentUsage).length, 2);
        });

        it("returns empty argumentUsage when no options data exists", async () => {
            const now = Date.now();
            const result = await getCommandDetail("mods", now - STATS_WINDOW_MS, now);
            assert.deepStrictEqual(result.argumentUsage, {});
        });
    });

    describe("recordCommandUsage()", () => {
        // Mirrors discord.js: options.data is the raw tree, so a subcommand arrives as the only
        // top-level option with the real arguments nested under it.
        function fakeInteraction({
            commandName,
            data,
            subcommand = null,
            group = null,
        }: {
            commandName: string;
            data: unknown[];
            subcommand?: string | null;
            group?: string | null;
        }): ChatInputCommandInteraction {
            return {
                commandName,
                options: {
                    getSubcommandGroup: () => group,
                    getSubcommand: () => subcommand,
                    data,
                },
                user: { id: "555555555555555555" },
                guildId: "444444444444444444",
                channelId: "333333333333333333",
                client: { shard: { ids: [0] } },
            } as unknown as ChatInputCommandInteraction;
        }

        it("stores the command and option names but no user data or option values", async () => {
            const interaction = fakeInteraction({
                commandName: "cs_recorded",
                data: [
                    { name: "allycode", type: 3, value: "123456789" },
                    { name: "user", type: 6, value: "555555555555555555" },
                ],
            });

            await recordCommandUsage(interaction, 42);
            await shutdown();

            const stored = await col().findOne({ commandName: "cs_recorded" }, { projection: { _id: 0 } });
            assert.ok(stored, "Expected the recorded command to be flushed to the collection");
            for (const field of ["userId", "guildId", "channelId"]) {
                assert.ok(!(field in stored), `Expected no ${field}, got: ${JSON.stringify(stored)}`);
            }
            assert.strictEqual(stored.executionTime, 42);
            assert.deepStrictEqual(stored.options, [
                { name: "allycode", type: 3 },
                { name: "user", type: 6 },
            ]);
        });

        it("stores the arguments under a subcommand, not the subcommand itself", async () => {
            const interaction = fakeInteraction({
                commandName: "cs_subcommand",
                subcommand: "character",
                data: [
                    {
                        name: "character",
                        type: 1,
                        options: [
                            { name: "allycode", type: 3, value: "123456789" },
                            { name: "unit", type: 3, value: "DARTHVADER" },
                        ],
                    },
                ],
            });

            await recordCommandUsage(interaction);
            await shutdown();

            const stored = await col().findOne({ commandName: "cs_subcommand" });
            assert.deepStrictEqual(stored?.options, [
                { name: "allycode", type: 3 },
                { name: "unit", type: 3 },
            ]);

            const now = Date.now();
            const detail = await getCommandDetail("cs_subcommand", now - STATS_WINDOW_MS, now);
            assert.deepStrictEqual(detail.argumentUsage, { allycode: 1, unit: 1 }, "/info cmdstats should list the arguments");
            assert.deepStrictEqual(detail.subcommandCounts, { character: 1 });
        });

        it("stores the arguments under a subcommand group", async () => {
            const interaction = fakeInteraction({
                commandName: "cs_group",
                group: "watch",
                subcommand: "set",
                data: [
                    {
                        name: "watch",
                        type: 2,
                        options: [{ name: "set", type: 1, options: [{ name: "channel", type: 7, value: "333333333333333333" }] }],
                    },
                ],
            });

            await recordCommandUsage(interaction);
            await shutdown();

            const stored = await col().findOne({ commandName: "cs_group" });
            assert.deepStrictEqual(stored?.options, [{ name: "channel", type: 7 }]);
        });

        it("writes the TTL-indexed field as a Date, so MongoDB can expire the document", async () => {
            const statsIndexes = indexConfig[env.MONGODB_SWGOHBOT_DB].commandStats;
            const ttlIndexes = statsIndexes.filter((idx) => idx.options?.expireAfterSeconds !== undefined);
            assert.strictEqual(ttlIndexes.length, 1, "Expected exactly one TTL index on commandStats");
            const ttlKey = JSON.stringify(ttlIndexes[0].key);
            // MongoDB refuses to create a second index on a key that differs only by options
            assert.strictEqual(
                statsIndexes.filter((idx) => JSON.stringify(idx.key) === ttlKey).length,
                1,
                `Key ${ttlKey} is indexed twice`,
            );

            await recordCommandUsage(fakeInteraction({ commandName: "cs_ttl", data: [] }));
            await shutdown();

            const [ttlField] = Object.keys(ttlIndexes[0].key);
            const stored = await col().findOne({ commandName: "cs_ttl" });
            assert.ok(
                stored?.[ttlField] instanceof Date,
                `TTL field "${ttlField}" must be a BSON Date or documents never expire, got: ${JSON.stringify(stored?.[ttlField])}`,
            );
        });
    });
});
