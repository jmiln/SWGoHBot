import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
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
    });
});
