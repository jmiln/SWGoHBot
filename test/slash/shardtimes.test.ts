import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { setGuildShardTimes } from "../../modules/guildConfig/shardTimes.ts";
import Shardtimes from "../../slash/shardtimes.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Guild/channel IDs used across tests.
// NOTE: This must be unique to this file. Test files run in parallel against a shared
// MongoDB, and other files (e.g. showconf.test.ts) delete the entire guildConfigs doc
// for their guild ID. Sharing an ID caused intermittent REM_MISSING failures here.
const GUILD_ID = "shardtimes-test-guild";
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
        // Default mock has no channel - !interaction.channel fires immediately, no MongoDB needed
        const interaction = createMockInteraction({ optionsData: { _subcommand: "view" } });
        const ctx = createCommandContext({ interaction });
        const command = new Shardtimes();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_COMMAND_UNAVAILABLE");
    });

    describe("view subcommand", () => {
        it("returns error when no users are registered in the channel", async () => {
            const interaction = makeShardInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_SHARDTIMES_NO_WATCHERS");
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

        it("renders the rest of the table when a stored timezone is no longer a valid zone", async () => {
            // Legacy rows predate `zoneType` and were validated by moment-timezone, which
            // normalized names before lookup. Those forms throw in Temporal, and one bad
            // row used to take down the whole view.
            await setGuildShardTimes({
                guildId: GUILD_ID,
                stOut: [
                    {
                        channelId: CHANNEL_ID,
                        times: {
                            GoodPlayer: { type: "name", timezone: "America/New_York", zoneType: "zone", flag: "" },
                            LegacyPlayer: { type: "name", timezone: "America_New_York", flag: "" } as any,
                        },
                    },
                ],
            });

            const interaction = makeShardInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embedData = replies[replies.length - 1].embeds[0].data || replies[replies.length - 1].embeds[0];
            const fields = embedData.fields as { name: string; value: string }[];

            const goodField = fields.find((f) => f.value.includes("GoodPlayer"));
            assert.ok(goodField, "Expected the valid entry to still be rendered");
            assert.match(goodField.name, /^\d{2}:\d{2}$/, "Expected a real time for the valid entry");

            const badField = fields.find((f) => f.value.includes("LegacyPlayer"));
            assert.ok(badField, "Expected the invalid entry to be rendered too");
            assert.strictEqual(badField.name, "??:??", "Expected the unusable entry to show a placeholder");
        });

        it("never reports a negative time until payout, whatever the local time is", async () => {
            // Offsets -12..+14 span 26 hours, so at any given instant several of these
            // zones are past their 18:00 payout and must roll over to tomorrow's.
            const times: Record<string, any> = {};
            for (let offset = -14; offset <= 12; offset++) {
                // Etc/GMT signs are inverted: Etc/GMT+5 is UTC-5
                times[`Player${offset + 14}`] = {
                    type: "name",
                    timezone: `Etc/GMT${offset >= 0 ? "+" : "-"}${Math.abs(offset)}`,
                    zoneType: "zone",
                    flag: "",
                };
            }
            await setGuildShardTimes({ guildId: GUILD_ID, stOut: [{ channelId: CHANNEL_ID, times: times }] });

            const interaction = makeShardInteraction({ _subcommand: "view" });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const embedData = replies[replies.length - 1].embeds[0].data || replies[replies.length - 1].embeds[0];
            const fields = embedData.fields as { name: string; value: string }[];

            for (const field of fields) {
                assert.match(field.name, /^\d{2}:\d{2}$/, `Expected a positive hh:mm, got "${field.name}"`);
                const [hour, minute] = field.name.split(":").map((n) => Number.parseInt(n, 10));
                assert.ok(hour < 24, `Expected under a day until payout, got "${field.name}"`);
                assert.ok(minute < 60, `Expected a valid minute, got "${field.name}"`);
            }
        });
    });

    describe("add subcommand", () => {
        it("succeeds when an admin adds another user with a valid timezone", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "ShardPlayer",
                timezone: "America/New_York",
            });
            const ctx = createCommandContext({ interaction, permLevel: 6 });
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
                user: "me",
                timezone: "not-a-valid-zone",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "BASE_INVALID_TIMEZONE");
        });

        it("returns error when both timezone and time_until are specified", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "me",
                timezone: "America/New_York",
                time_until: "02:30",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_SHARDTIMES_CONFLICTING_OPTIONS");
        });

        it("returns error when neither timezone nor time_until is specified", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "me",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "You need to specify");
        });

        it("succeeds with a valid time_until value", async () => {
            const interaction = makeShardInteraction({
                _subcommand: "add",
                user: "me",
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
            const ctx = createCommandContext({ interaction, permLevel: 6 });
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
                user: "me",
            });
            const ctx = createCommandContext({ interaction });
            const command = new Shardtimes();
            await command.run(ctx);
            assertErrorReply(interaction, "COMMAND_SHARDTIMES_REM_MISSING");
        });
    });
});
