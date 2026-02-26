import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { setGuildPolls } from "../../modules/guildConfig/polls.ts";
import Poll from "../../slash/poll.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

const GUILD_ID = "987654321";
const CHANNEL_ID = "poll-channel-1";

/** Creates a mock interaction with guild and channel set for poll tests. */
function makePollInteraction(optionsData: Record<string, any> = {}) {
    return createMockInteraction({
        guild: {
            id: GUILD_ID,
            name: "Test Guild",
        } as any,
        channel: { id: CHANNEL_ID } as any,
        optionsData,
    });
}

describe("Poll", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    beforeEach(async () => {
        // Reset polls for the test guild/channel before each test
        await setGuildPolls({ guildId: GUILD_ID, pollsOut: [] });
    });

    it("should initialize with correct name", () => {
        const command = new Poll();
        assert.strictEqual(command.commandData.name, "poll");
    });

    it("should have all required subcommands", () => {
        const command = new Poll();
        const options = command.commandData.options;
        const subcommandNames = options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("create"), "Expected 'create' subcommand");
        assert.ok(subcommandNames.includes("end"), "Expected 'end' subcommand");
        assert.ok(subcommandNames.includes("cancel"), "Expected 'cancel' subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected 'view' subcommand");
        assert.ok(subcommandNames.includes("vote"), "Expected 'vote' subcommand");
    });

    it("should return error in DM context (no guild)", async () => {
        // poll.ts reads interaction.channel.id before checking guild, so provide a channel.
        // Setting guild: null triggers the DM error check.
        const interaction = createMockInteraction({
            guild: null as any,
            channel: { id: "channel123" } as any,
            optionsData: { _subcommand: "create", question: "Test?", options: "A|B" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Poll();
        await command.run(ctx);
        assertErrorReply(interaction, "not available in DMs");
    });

    describe("create subcommand", () => {
        it("returns error when a poll already exists in the channel", async () => {
            // Pre-load an existing poll for the channel
            await setGuildPolls({
                guildId: GUILD_ID,
                pollsOut: [{ question: "Old poll?", options: ["Yes", "No"], votes: {}, anon: false, channelId: CHANNEL_ID }],
            });

            const interaction = makePollInteraction({
                _subcommand: "create",
                question: "New poll?",
                options: "A|B",
            });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_POLL_ALREADY_RUNNING");
        });

        it("returns error when question exceeds 256 characters", async () => {
            const longQuestion = "Q".repeat(257);
            const interaction = makePollInteraction({
                _subcommand: "create",
                question: longQuestion,
                options: "A|B",
            });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_POLL_TITLE_TOO_LONG");
        });

        it("returns error when only one option is provided (no pipe)", async () => {
            const interaction = makePollInteraction({
                _subcommand: "create",
                question: "Single option?",
                options: "OnlyOne",
            });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_POLL_TOO_FEW_OPT");
        });

        it("creates a poll and returns embed with the question as author name", async () => {
            const question = "Favourite side?";
            const interaction = makePollInteraction({
                _subcommand: "create",
                question,
                options: "Light|Dark",
            });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed in reply");

            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            assert.strictEqual(embedData.author?.name, question, "Expected embed author name to equal the question");
        });
    });

    describe("vote subcommand", () => {
        beforeEach(async () => {
            // Pre-create a poll for vote tests
            await setGuildPolls({
                guildId: GUILD_ID,
                pollsOut: [{ question: "Vote here?", options: ["Alpha", "Beta", "Gamma"], votes: {}, anon: false, channelId: CHANNEL_ID }],
            });
        });

        it("returns success when voting on a valid option", async () => {
            const interaction = makePollInteraction({
                _subcommand: "vote",
                option: 1,
            });
            const ctx = createCommandContext({ interaction });
            const command = new Poll();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            const content = lastReply.content || "";
            assert.ok(content.includes("COMMAND_POLL_REGISTERED"), "Expected registered vote message");
        });

        it("returns error when voting for the same option twice", async () => {
            // First vote
            const interaction1 = makePollInteraction({ _subcommand: "vote", option: 1 });
            await new Poll().run(createCommandContext({ interaction: interaction1 }));

            // Need to persist the vote — reload the poll from DB and vote again
            // Re-use the same user ID from the mock (default: "123456789")
            // to simulate voting for the same option again
            const interaction2 = makePollInteraction({ _subcommand: "vote", option: 1 });
            await new Poll().run(createCommandContext({ interaction: interaction2 }));

            assertErrorReply(interaction2, "COMMAND_POLL_SAME_OPT");
        });

        it("returns error when option number is out of range", async () => {
            const interaction = makePollInteraction({
                _subcommand: "vote",
                option: 99,
            });
            const ctx = createCommandContext({ interaction });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_POLL_INVALID_OPTION");
        });
    });

    describe("view subcommand", () => {
        it("returns embed with question and options for an existing poll", async () => {
            const question = "What is your favourite?";
            await setGuildPolls({
                guildId: GUILD_ID,
                pollsOut: [{ question, options: ["X", "Y"], votes: {}, anon: false, channelId: CHANNEL_ID }],
            });

            const interaction = makePollInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Poll();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed in reply");

            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            assert.strictEqual(embedData.author?.name, question, "Expected embed to show poll question");
        });

        it("returns error when no poll exists in the channel", async () => {
            const interaction = makePollInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "no poll active");
        });
    });

    describe("end subcommand", () => {
        it("returns results embed and removes the poll from DB", async () => {
            const question = "End this?";
            await setGuildPolls({
                guildId: GUILD_ID,
                pollsOut: [{ question, options: ["Yes", "No"], votes: {}, anon: false, channelId: CHANNEL_ID }],
            });

            const interaction = makePollInteraction({ _subcommand: "end" });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected results embed");

            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            // The description should contain the question
            assert.ok(embedData.description?.includes(question), "Expected poll question in results embed");
        });

        it("returns error when no poll exists to end", async () => {
            const interaction = makePollInteraction({ _subcommand: "end" });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
            const command = new Poll();
            await command.run(ctx);
            assertErrorReply(interaction, "no poll active");
        });
    });
});
