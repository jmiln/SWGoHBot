import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { Collection } from "discord.js";
import cache from "../../modules/cache.ts";
import { getGuildShardTimes, setGuildShardTimes } from "../../modules/guildConfig/shardTimes.ts";
import Shardtimes from "../../slash/shardtimes.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockGuildSettings, createMockInteraction, createRealLanguage } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Must be unique to this file: tests run in parallel against a shared MongoDB, where other
// suites wipe whole guildConfigs docs.
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
            // Legacy rows predate `zoneType` and carry moment-timezone-normalized names, which
            // throw in Temporal; one bad row must not take down the whole view.
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

        it("looks up every ID entry in one request and shows display names", async () => {
            const ALICE = "111111111111111111";
            const GONE = "222222222222222222";
            await setGuildShardTimes({
                guildId: GUILD_ID,
                stOut: [
                    {
                        channelId: CHANNEL_ID,
                        times: {
                            [ALICE]: { type: "id", timezone: "America/New_York", zoneType: "zone", flag: "" },
                            [GONE]: { type: "id", timezone: "America/New_York", zoneType: "zone", flag: "" },
                            NamedPlayer: { type: "name", timezone: "America/New_York", zoneType: "zone", flag: "" },
                        },
                    },
                ],
            });

            const interaction = makeShardInteraction({ _subcommand: "view" });
            const requests: unknown[] = [];
            (interaction.guild as any).members.fetch = async (arg: unknown) => {
                requests.push(arg);
                return new Collection([[ALICE, { id: ALICE, displayName: "Alice" }]]);
            };
            await new Shardtimes().run(createCommandContext({ interaction }));

            assert.deepStrictEqual(requests, [{ user: [ALICE, GONE] }], "Expected one lookup for both ID entries");
            const replies = (interaction as any)._getReplies();
            const embedData = replies[replies.length - 1].embeds[0].data || replies[replies.length - 1].embeds[0];
            const values = (embedData.fields as { value: string }[]).map((f) => f.value).join("\n");
            assert.ok(values.includes("**Alice**"), `Expected the member's display name, got: ${values}`);
            assert.ok(values.includes(`**${GONE}**`), `Expected the raw ID for a user no longer in the server, got: ${values}`);
            assert.ok(values.includes("NamedPlayer"), "Expected name entries unchanged");
        });

        it("still renders the table with raw IDs when the member lookup fails", async () => {
            const ALICE = "111111111111111111";
            await setGuildShardTimes({
                guildId: GUILD_ID,
                stOut: [
                    {
                        channelId: CHANNEL_ID,
                        times: { [ALICE]: { type: "id", timezone: "America/New_York", zoneType: "zone", flag: "" } },
                    },
                ],
            });

            const interaction = makeShardInteraction({ _subcommand: "view" });
            (interaction.guild as any).members.fetch = async () => {
                throw new Error("Members didn't arrive in time.");
            };
            await new Shardtimes().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const embedData = replies[replies.length - 1].embeds[0].data || replies[replies.length - 1].embeds[0];
            assert.ok(embedData.fields[0].value.includes(`**${ALICE}**`), "Expected the raw ID as the fallback name");
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

    describe("behavior", () => {
        const SELF_ID = "123456789"; // the mock interaction's user
        const OTHER_ID = "333333333333333333";
        const DEST_ID = "shard-dest-channel";

        const entry = (overrides: Record<string, unknown> = {}) => ({
            type: "name",
            timezone: "America/New_York",
            zoneType: "zone",
            flag: "",
            ...overrides,
        });

        async function runShard(
            optionsData: Record<string, any>,
            {
                permLevel = 0,
                me = { id: "bot123" } as any,
                guildSettings = {},
                emojis = {} as Record<string, string>,
                shard = null as any,
            } = {},
        ) {
            const interaction = makeShardInteraction(optionsData);
            (interaction.guild as any).members.me = me;
            for (const [id, markup] of Object.entries(emojis)) {
                (interaction as any).client.emojis.cache.set(id, { id, toString: () => markup });
            }
            (interaction as any).client.shard = shard;
            await new Shardtimes().run(
                createCommandContext({
                    interaction,
                    permLevel,
                    language: createRealLanguage(),
                    guildSettings: createMockGuildSettings(guildSettings),
                }),
            );
            const reply = (interaction as any)._getReplies().at(-1);
            const embed = reply?.embeds?.[0]?.data ?? reply?.embeds?.[0];
            return { reply, embed, text: reply?.content ?? embed?.description ?? "", interaction };
        }

        // Node re-reads process.env.TZ on assignment, so local-time Date methods follow it
        const setProcessTimezone = (t: { after: (fn: () => void) => void }, tz: string) => {
            const original = process.env.TZ;
            process.env.TZ = tz;
            t.after(() => {
                if (original === undefined) delete process.env.TZ;
                else process.env.TZ = original;
            });
        };

        const stored = async () => getGuildShardTimes({ guildId: GUILD_ID });
        const timesIn = async (channelId: string) => (await stored()).find((sh) => sh.channelId === channelId)?.times;

        describe("add", () => {
            it("registers the caller by ID for 'me'", async () => {
                await runShard({ _subcommand: "add", user: "me", timezone: "Europe/London" });

                assert.deepStrictEqual((await timesIn(CHANNEL_ID))?.[SELF_ID], {
                    type: "id",
                    zoneType: "zone",
                    timezone: "Europe/London",
                    flag: "",
                });
            });

            it("lets an admin register someone else by mention", async () => {
                const { text } = await runShard(
                    { _subcommand: "add", user: `<@${OTHER_ID}>`, timezone: "Europe/London" },
                    { permLevel: 6 },
                );

                assert.strictEqual(text, "User successfully added!");
                assert.strictEqual((await timesIn(CHANNEL_ID))?.[OTHER_ID]?.type, "id");
            });

            it("stops a non-admin registering someone else", async () => {
                const { text } = await runShard({ _subcommand: "add", user: "SomeoneElse", timezone: "Europe/London" });

                assert.strictEqual(text, "Sorry, but you can only remove yourself unless you have an admin role.");
                assert.strictEqual(await timesIn(CHANNEL_ID), undefined);
            });

            it("stores a UTC offset in minutes", async () => {
                await runShard({ _subcommand: "add", user: "Plus", timezone: "+5:30" }, { permLevel: 6 });
                await runShard({ _subcommand: "add", user: "Minus", timezone: "-4:15" }, { permLevel: 6 });

                const times = await timesIn(CHANNEL_ID);
                assert.deepStrictEqual([times?.Plus.zoneType, times?.Plus.timezone], ["utc", 330]);
                assert.deepStrictEqual([times?.Minus.zoneType, times?.Minus.timezone], ["utc", -255]);
            });

            it("stores time_until as a quarter-hour UTC time", async () => {
                await runShard({ _subcommand: "add", user: "Soon", time_until: "02:30" }, { permLevel: 6 });

                const soon = (await timesIn(CHANNEL_ID))?.Soon;
                assert.strictEqual(soon?.zoneType, "hhmm");
                assert.match(String(soon?.timezone), /^\d{1,2}:(00|15|30|45)$/);
            });

            it("stores time_until in UTC even when the process is not in UTC", async (t) => {
                setProcessTimezone(t, "America/New_York");
                t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 5, 1, 12, 0) });

                const { text } = await runShard({ _subcommand: "add", user: "Soon", time_until: "02:30" }, { permLevel: 6 });

                assert.strictEqual((await timesIn(CHANNEL_ID))?.Soon.timezone, "14:30", "12:00 UTC + 2:30 is 14:30 UTC");
                assert.strictEqual(text, "User successfully added!");
            });

            it("rejects a malformed time_until", async () => {
                const { text } = await runShard({ _subcommand: "add", user: "me", time_until: "soon" });

                assert.ok(text.startsWith("Invalid time until your payout"), text);
            });

            describe("flag", () => {
                const addWithFlag = (flag: string, opts: { emojis?: Record<string, string>; shard?: any } = {}) =>
                    runShard({ _subcommand: "add", user: "Flagged", timezone: "Europe/London", flag }, { permLevel: 6, ...opts });
                const storedFlag = async () => (await timesIn(CHANNEL_ID))?.Flagged?.flag;

                for (const [label, flag] of [
                    ["a standard emoji", "\u{1F600}"],
                    ["a flag pair", "\u{1F1FA}\u{1F1F8}"],
                    ["a single ASCII symbol", "*"],
                ] as const) {
                    it(`accepts ${label} as typed`, async () => {
                        const { text } = await addWithFlag(flag);

                        assert.strictEqual(text, "User successfully added!");
                        assert.strictEqual(await storedFlag(), flag);
                    });
                }

                it("accepts a custom or animated emoji the bot can use, stored as its full markup", async () => {
                    await addWithFlag("<:flag_us:445566>", { emojis: { "445566": "<:flag_us:445566>" } });
                    assert.strictEqual(await storedFlag(), "<:flag_us:445566>");

                    await addWithFlag("<a:spin:778899>", { emojis: { "778899": "<a:spin:778899>" } });
                    assert.strictEqual(await storedFlag(), "<a:spin:778899>");
                });

                it("finds a custom emoji on another shard", async () => {
                    const otherShardClient = { emojis: { cache: new Map([["445566", {}]]) } };
                    const thisShardClient = { emojis: { cache: new Map() } };
                    const shard = {
                        broadcastEval: async (fn: (c: any, ctx: any) => unknown, { context }: { context: unknown }) => [
                            fn(thisShardClient, context),
                            fn(otherShardClient, context),
                        ],
                    };

                    const { text } = await addWithFlag("<:flag_us:445566>", { shard });

                    assert.strictEqual(text, "User successfully added!");
                    assert.strictEqual(await storedFlag(), "<:flag_us:445566>");
                });

                for (const [label, flag] of [
                    ["a custom emoji the bot can't use", "<:flag_us:445566>"],
                    ["plain text", "US"],
                    ["a single letter", "A"],
                    ["two emoji", "\u{1F600}\u{1F600}"],
                ] as const) {
                    it(`rejects ${label} and saves nothing`, async () => {
                        const { text } = await addWithFlag(flag);

                        assert.strictEqual(
                            text,
                            "That flag isn't something I can show. Use one emoji (standard, or custom from a server I'm in) or a single symbol like *",
                        );
                        assert.strictEqual(await storedFlag(), undefined);
                    });
                }
            });

            for (const [label, previous, expectedFrom] of [
                ["UTC offset", { zoneType: "utc", timezone: 330 }, "+5:30"],
                ["negative UTC offset", { zoneType: "utc", timezone: -255 }, "-4:15"],
                ["time_until", { zoneType: "hhmm", timezone: "13:45" }, "13:45 UTC"],
                ["zone", { zoneType: "zone", timezone: "Asia/Tokyo" }, "Asia/Tokyo"],
                ["legacy entry", { zoneType: undefined, timezone: "Asia/Tokyo" }, "Asia/Tokyo"],
            ] as const) {
                it(`reports the old and new time when re-adding a ${label}`, async () => {
                    await setGuildShardTimes({
                        guildId: GUILD_ID,
                        stOut: [{ channelId: CHANNEL_ID, times: { Mover: entry(previous) as any } }],
                    });

                    const { text } = await runShard({ _subcommand: "add", user: "Mover", timezone: "Europe/London" }, { permLevel: 6 });

                    assert.strictEqual(text, `Updated user from ${expectedFrom} to Europe/London.`);
                    assert.strictEqual((await timesIn(CHANNEL_ID))?.Mover.timezone, "Europe/London");
                });
            }

            it("leaves other channels' entries alone", async () => {
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [{ channelId: "other-channel", times: { Elsewhere: entry() as any } }],
                });

                await runShard({ _subcommand: "add", user: "Here", timezone: "Europe/London" }, { permLevel: 6 });

                assert.ok((await timesIn("other-channel"))?.Elsewhere);
                assert.ok((await timesIn(CHANNEL_ID))?.Here);
            });
        });

        describe("remove", () => {
            it("lets an admin remove someone by mention", async () => {
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [{ channelId: CHANNEL_ID, times: { [OTHER_ID]: entry({ type: "id" }) as any } }],
                });

                const { text } = await runShard({ _subcommand: "remove", user: `<@${OTHER_ID}>` }, { permLevel: 6 });

                assert.strictEqual(text, "User successfully removed!");
                assert.deepStrictEqual(await timesIn(CHANNEL_ID), {});
            });

            it("lets anyone remove themselves with 'me'", async () => {
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [{ channelId: CHANNEL_ID, times: { [SELF_ID]: entry({ type: "id" }) as any } }],
                });

                await runShard({ _subcommand: "remove", user: "me" });

                assert.deepStrictEqual(await timesIn(CHANNEL_ID), {});
            });

            it("stops a non-admin removing someone else", async () => {
                await setGuildShardTimes({ guildId: GUILD_ID, stOut: [{ channelId: CHANNEL_ID, times: { Other: entry() as any } }] });

                const { text } = await runShard({ _subcommand: "remove", user: "Other" });

                assert.strictEqual(text, "Sorry, but you can only remove yourself unless you have an admin role.");
                assert.ok((await timesIn(CHANNEL_ID))?.Other);
            });
        });

        describe("copy", () => {
            const copyTo = (dest: unknown, opts: { permLevel?: number; me?: any } = {}) =>
                runShard({ _subcommand: "copy", dest_channel: dest }, { permLevel: 6, ...opts });
            const postable = (id: string, canPost = true) => ({
                id,
                guild: { id: GUILD_ID },
                permissionsFor: () => ({ has: () => canPost }),
            });

            beforeEach(async () => {
                await setGuildShardTimes({ guildId: GUILD_ID, stOut: [{ channelId: CHANNEL_ID, times: { Source: entry() as any } }] });
            });

            it("copies this channel's entries to a channel that has none", async () => {
                const { text } = await copyTo(postable(DEST_ID));

                assert.strictEqual(text, `Shard info copied to <#${DEST_ID}>`);
                assert.deepStrictEqual(Object.keys((await timesIn(DEST_ID)) ?? {}), ["Source"]);
                assert.ok((await timesIn(CHANNEL_ID))?.Source, "the source keeps its entries");
            });

            it("fills a destination that exists but is empty", async () => {
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [
                        { channelId: CHANNEL_ID, times: { Source: entry() as any } },
                        { channelId: DEST_ID, times: {} },
                    ],
                });

                await copyTo(postable(DEST_ID));

                assert.deepStrictEqual(Object.keys((await timesIn(DEST_ID)) ?? {}), ["Source"]);
                assert.strictEqual((await stored()).length, 2, "no duplicate destination entry");
            });

            it("refuses to overwrite a destination that has entries", async () => {
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [
                        { channelId: CHANNEL_ID, times: { Source: entry() as any } },
                        { channelId: DEST_ID, times: { Existing: entry() as any } },
                    ],
                });

                const { text } = await copyTo(postable(DEST_ID));

                assert.strictEqual(text, "Sorry, but the destination channel already has some shard info listed");
                assert.deepStrictEqual(Object.keys((await timesIn(DEST_ID)) ?? {}), ["Existing"]);
            });

            it("refuses to copy a channel onto itself", async () => {
                const { text } = await copyTo(postable(CHANNEL_ID));

                assert.strictEqual(text, "You can't copy to/from the same channel");
            });

            it("refuses a destination the bot can't post in", async () => {
                const { text } = await copyTo(postable(DEST_ID, false));

                assert.strictEqual(text, `I don't have permission to view/send messages in <#${DEST_ID}>`);
                assert.strictEqual(await timesIn(DEST_ID), undefined);
            });

            it("refuses when this channel has nothing to copy", async () => {
                await setGuildShardTimes({ guildId: GUILD_ID, stOut: [{ channelId: CHANNEL_ID, times: {} }] });

                const { text } = await copyTo(postable(DEST_ID));

                assert.strictEqual(text, "This channel doesn't have any shard times to copy from.");
                assert.strictEqual(await timesIn(DEST_ID), undefined);
            });

            it("needs an admin, a destination, and the bot in the server", async () => {
                const notAdmin = await copyTo(postable(DEST_ID), { permLevel: 0 });
                const noDest = await copyTo(undefined);
                const noBot = await copyTo(postable(DEST_ID), { me: null });

                assert.ok(notAdmin.text.startsWith("Sorry, but either you're not an admin"), notAdmin.text);
                assert.strictEqual(noDest.text, "Cannot find a match for ``");
                assert.strictEqual(noBot.text, `I don't have permission to view/send messages in <#${DEST_ID}>`);
                assert.strictEqual(await timesIn(DEST_ID), undefined);
            });
        });

        describe("view", () => {
            // 12:00 UTC: today's 18:00/19:00 UTC payouts are 6/7 hours away
            const NOW = Date.UTC(2030, 5, 1, 12, 0);

            it("times UTC-offset and time_until entries, for characters and ships", async (t) => {
                t.mock.timers.enable({ apis: ["Date"], now: NOW });
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [
                        {
                            channelId: CHANNEL_ID,
                            times: {
                                AtUtc: entry({ zoneType: "utc", timezone: 0 }) as any,
                                PlusFiveThirty: entry({ zoneType: "utc", timezone: 330 }) as any,
                                Fixed: entry({ zoneType: "hhmm", timezone: "20:30" }) as any,
                            },
                        },
                    ],
                });

                const chars = await runShard({ _subcommand: "view" });
                const ships = await runShard({ _subcommand: "view", ships: true });

                const byName = (embed: any) => Object.fromEntries(embed.fields.map((f: any) => [f.value, f.name]));
                assert.deepStrictEqual(byName(chars.embed), { AtUtc: "06:00", PlusFiveThirty: "00:30", Fixed: "08:30" });
                assert.deepStrictEqual(byName(ships.embed), { AtUtc: "07:00", PlusFiveThirty: "01:30", Fixed: "08:30" });
            });

            it("rolls a payout that has passed today over to tomorrow", async (t) => {
                t.mock.timers.enable({ apis: ["Date"], now: NOW });
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [{ channelId: CHANNEL_ID, times: { Early: entry({ zoneType: "hhmm", timezone: "11:00" }) as any } }],
                });

                const { embed } = await runShard({ _subcommand: "view" });

                assert.strictEqual(embed.fields[0].name, "23:00");
            });

            it("times a time_until entry from the UTC date, even when the local date is still yesterday", async (t) => {
                // 02:00 UTC on the 2nd is 22:00 on the 1st in New York; today's 01:00 UTC payout has passed
                setProcessTimezone(t, "America/New_York");
                t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 5, 2, 2, 0) });
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [{ channelId: CHANNEL_ID, times: { Late: entry({ zoneType: "hhmm", timezone: "1:00" }) as any } }],
                });

                const { embed } = await runShard({ _subcommand: "view" });

                assert.strictEqual(embed.fields[0].name, "23:00");
            });

            it("groups by time, sorts names, and stacks them when vertical", async (t) => {
                t.mock.timers.enable({ apis: ["Date"], now: NOW });
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [
                        {
                            channelId: CHANNEL_ID,
                            times: {
                                zed: entry({ zoneType: "utc", timezone: 0 }) as any,
                                Amy: entry({ zoneType: "utc", timezone: 0 }) as any,
                            },
                        },
                    ],
                });

                const flat = await runShard({ _subcommand: "view" });
                const vertical = await runShard({ _subcommand: "view" }, { guildSettings: { shardtimeVertical: true } });

                assert.strictEqual(flat.embed.fields[0].value, "Amy - zed");
                assert.strictEqual(vertical.embed.fields[0].value, "Amy\nzed");
            });

            it("shows each kind of flag before its name", async (t) => {
                t.mock.timers.enable({ apis: ["Date"], now: NOW });
                const flagged = (flag: string) => entry({ zoneType: "utc", timezone: 0, flag }) as any;
                await setGuildShardTimes({
                    guildId: GUILD_ID,
                    stOut: [
                        {
                            channelId: CHANNEL_ID,
                            times: {
                                a_custom: flagged("<:us:445566>"),
                                b_standard: flagged("\u{1F600}"),
                                c_symbol: flagged("*"),
                                d_legacyCached: flagged("112233"),
                                e_legacyGone: flagged("998877"),
                            },
                        },
                    ],
                });

                const { embed } = await runShard({ _subcommand: "view" }, { emojis: { "112233": "<:old:112233>" } });

                assert.deepStrictEqual(embed.fields[0].value.split(" - "), [
                    "<:us:445566>a_custom",
                    "\u{1F600}b_standard",
                    "\\*c_symbol",
                    "<:old:112233>d_legacyCached",
                    "e_legacyGone",
                ]);
            });
        });
    });
});
