import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { setGuildShardTimes } from "../../modules/guildConfig/shardTimes.ts";
import Shardtimes from "../../slash/shardtimes.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Guild/channel IDs used across tests
const GUILD_ID = "987654321";
const CHANNEL_ID = "test-channel-shard";

/** Creates a mock interaction with guild, channel, and client.emojis set up for shardtimes. */
function makeShardInteraction(optionsData: Record<string, any> = {}) {
    return createMockInteraction({
        guild: {
            id: GUILD_ID,
            name: "Test Guild",
            members: {
                me: null,
                fetch: async () => null,
            },
            roles: { cache: new Map() },
        } as any,
        channel: { id: CHANNEL_ID } as any,
        client: {
            user: { id: "bot123", username: "BotUser" },
            shard: null,
            guilds: { cache: { size: 1500 } },
            users: { cache: { size: 50000 } },
            emojis: { cache: new Map() },
        } as any,
        optionsData,
    });
}

describe("Shardtimes", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    beforeEach(async () => {
        // Reset shard times for the test guild before each test
        await setGuildShardTimes({ guildId: GUILD_ID, stOut: [] });
    });

    it("should initialize with correct name", () => {
        const command = new Shardtimes();
        assert.strictEqual(command.commandData.name, "shardtimes");
    });

    it("should have add, remove, copy, and view subcommands", () => {
        const command = new Shardtimes();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("add"), "Expected add subcommand");
        assert.ok(subcommandNames.includes("remove"), "Expected remove subcommand");
        assert.ok(subcommandNames.includes("copy"), "Expected copy subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when no channel is present (DM context)", async () => {
        // Default mock has no channel — !interaction.channel fires immediately, no MongoDB needed
        const interaction = createMockInteraction({ optionsData: { _subcommand: "view" } });
        const ctx = createCommandContext({ interaction });
        const command = new Shardtimes();
        await command.run(ctx);
        assertErrorReply(interaction, "not available in DMs");
    });

    describe("view subcommand", () => {
        it("returns error when no users are registered in the channel", async () => {
            const interaction = makeShardInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "don't have anyone registered");
        });

        it("returns an embed with fields when shard times exist", async () => {
            // Pre-load a shard time entry using type "name" to skip member fetch
            await setGuildShardTimes({
                guildId: GUILD_ID,
                stOut: [
                    {
                        channelId: CHANNEL_ID,
                        times: {
                            ShardPlayer: { type: "name", timezone: "America/New_York", zoneType: "zone", flag: "" },
                        },
                    },
                ],
            });

            const interaction = makeShardInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed in reply");
            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            assert.ok(embedData.fields?.length > 0, "Expected at least one field in embed");
        });
    });

    describe("add subcommand", () => {
        it("succeeds with a valid timezone and non-self user name", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
                timezone: "America/New_York",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            const content = lastReply.content || "";
            assert.ok(content.includes("COMMAND_SHARDTIMES_USER_ADDED"), "Expected success message");
        });

        it("returns error for an invalid timezone string", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
                timezone: "not-a-valid-zone",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_SHARDTIMES_INVALID_TIMEZONE");
        });

        it("returns error when both timezone and time_until are specified", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
                timezone: "America/New_York",
                time_until: "02:30",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "may not use both");
        });

        it("returns error when neither timezone nor time_until is specified", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "You need to specify");
        });

        it("succeeds with a valid time_until value", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
                time_until: "02:30",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            const content = lastReply.content || "";
            assert.ok(content.includes("COMMAND_SHARDTIMES_USER_ADDED"), "Expected success message");
        });
    });

    describe("remove subcommand", () => {
        it("succeeds when user is in the shard times list", async () => {
            // Pre-load the user to be removed
            await setGuildShardTimes({
                guildId: GUILD_ID,
                stOut: [
                    {
                        channelId: CHANNEL_ID,
                        times: {
                            ShardPlayer: { type: "name", timezone: "America/New_York", zoneType: "zone", flag: "" },
                        },
                    },
                ],
            });

            const interaction = makeShardInteraction({
                _subcommand: "remove",
                user: "ShardPlayer",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected a reply");
            const lastReply = replies[replies.length - 1];
            const content = lastReply.content || "";
            assert.ok(content.includes("COMMAND_SHARDTIMES_REM_SUCCESS"), "Expected success message");
        });

        it("returns error when user is not in the shard times list", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "remove",
                user: "ShardPlayer",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_SHARDTIMES_REM_MISSING");
        });
    });
});
