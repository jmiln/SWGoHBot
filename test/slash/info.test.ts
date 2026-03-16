import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import database from "../../modules/database.ts";
import Info from "../../slash/info.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Info", () => {
    let mongoClient: MongoClient;

    before(async () => {
        mongoClient = await getMongoClient();
        database.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    describe("/info stats", () => {
        it("should display bot information and stats", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "stats" },
            });

            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            const reply = replies[0];
            assert.ok(reply.embeds, "Expected embed reply");

            const embed = reply.embeds[0];
            assert.ok(embed.author, "Expected author in embed");
            assert.ok(embed.description, "Expected description with stats");
            assert.ok(embed.description.length > 0, "Expected non-empty description");
        });

        it("should include links in embed fields", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "stats" },
            });

            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            assert.ok(embed.fields !== undefined, "Expected fields in embed");
        });

        it("should send exactly one reply", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "stats" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);
            assertReplyCount(interaction, 1);
        });

        it("should have a random color for the embed", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "stats" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            assert.ok(typeof embed.color === "number", "Expected numeric color");
            assert.ok(embed.color >= 0 && embed.color <= 0xffffff, "Expected valid color range");
        });
    });

    describe("/info cmdstats", () => {
        const col = () => mongoClient.db(env.MONGODB_SWGOHBOT_DB).collection("commandStats");

        before(async () => {
            const now = Date.now();
            await col().insertMany([
                { commandName: "mycharacter", subcommand: "character", count: 1, success: true, timestamp: now, options: [{ name: "allycode", type: 3, value: "123" }] },
                { commandName: "mycharacter", subcommand: "ship", count: 1, success: true, timestamp: now },
                { commandName: "noargs", subcommand: "list", count: 1, success: true, timestamp: now },
                ...Array.from({ length: 11 }, (_, i) => ({
                    commandName: "manyargs",
                    subcommand: null,
                    count: 1,
                    success: true,
                    timestamp: now,
                    options: [{ name: `arg${i}`, type: 3, value: "x" }],
                })),
            ]);
        });

        after(async () => {
            await col().drop().catch(() => {});
        });

        it("should display top commands list when no command arg is given", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats" },
            });

            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            const embed = replies[0].embeds[0];
            assert.ok(embed.description, "Expected description");
        });

        it("should display detail view when command arg is given", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "mods" },
            });

            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            const embed = replies[0].embeds[0];
            assert.ok(embed.description, "Expected description");
        });

        it("should send exactly one reply for cmdstats", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);
            assertReplyCount(interaction, 1);
        });

        it("should show percentages in subcommand breakdown", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "mycharacter" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            const subField = embed.fields?.find((f: { name: string }) => f.name === "Subcommands");
            assert.ok(subField, "Expected Subcommands field");
            assert.ok(subField.value.includes("(50%)"), "Expected 50% for each subcommand");
        });

        it("should include Arguments field when options data exists", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "mycharacter" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            const argField = embed.fields?.find((f: { name: string }) => f.name === "Arguments (across all subcommands)");
            assert.ok(argField, "Expected Arguments field when options data exists");
            assert.ok(argField.value.includes("allycode"), "Expected allycode in arguments field");
            assert.ok(argField.value.includes("(50%)"), "Expected 50% for allycode argument");
        });

        it("should omit Arguments field when no options data exists", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "noargs" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            const argField = embed.fields?.find((f: { name: string }) => f.name === "Arguments (across all subcommands)");
            assert.strictEqual(argField, undefined, "Expected no Arguments field when no options data");
        });

        it("should show overflow marker when more than 10 argument types exist", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "manyargs" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            const argField = embed.fields?.find((f: { name: string }) => f.name === "Arguments (across all subcommands)");
            assert.ok(argField, "Expected Arguments field");
            assert.ok(argField.value.includes("+ 1 more"), "Expected overflow marker");
        });

        it("should show no usage data message for unknown command", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "cmdstats", command: "unknowncmd" },
            });
            const command = new Info();
            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embed = replies[0].embeds[0];
            assert.ok(embed.description?.includes("No usage data found"), "Expected no usage data message");
        });
    });
});
