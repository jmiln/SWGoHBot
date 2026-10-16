import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import cache from "../../modules/cache.ts";
import eventSocket from "../../modules/eventSocket.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import { getGuildEvents, setEvents } from "../../modules/guildConfig/events.ts";
import { setGuildSettings } from "../../modules/guildConfig/settings.ts";
import { defaultGuildSettings } from "../../schemas/guildConfigs.schema.ts";
import Event from "../../slash/event.ts";
import type { GuildConfigEvent } from "../../types/guildConfig_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createRealLanguage } from "../mocks/index.ts";

// File-unique guild for tests that write guildConfigs; the mock default guild is shared with other files
const EV_GUILD = "event-test-guild";

// 12:30 in America/Los_Angeles (the default timezone), minute-aligned so edit's date round trip is exact
const FUTURE_DT = Date.UTC(2030, 5, 1, 19, 30);

function storedEvent(overrides: Partial<GuildConfigEvent> = {}): GuildConfigEvent {
    return {
        name: "stored",
        eventDT: FUTURE_DT,
        message: "",
        channel: "channel1",
        countdown: false,
        repeat: { repeatDay: 0, repeatHour: 0, repeatMin: 0 },
        repeatDays: [],
        ...overrides,
    };
}

// A guild whose channels are sendable and grant the bot view/send, for the trigger tests
function createSendableGuild(sent: { channel: string; content: string }[], { failSend = false } = {}) {
    const makeChannel = (id: string, name: string) => ({
        id,
        name,
        guild: { id: EV_GUILD },
        isSendable: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async ({ content }: { content: string }) => {
            if (failSend) throw new Error("Missing Access");
            sent.push({ channel: id, content });
        },
    });
    return createMockGuild({
        id: EV_GUILD,
        channels: {
            cache: Object.assign(
                new Map([
                    ["channel1", makeChannel("channel1", "general")],
                    ["channel2", makeChannel("channel2", "announce")],
                ]),
                {
                    find(this: Map<string, any>, predicate: (value: any) => boolean) {
                        return [...this.values()].find(predicate);
                    },
                },
            ),
        },
    });
}

async function clearEventGuild() {
    await guildConfigDB.remove({ guildId: EV_GUILD });
}

// Helper to create a mock guild with channels
function createMockGuild(overrides = {}) {
    const channelsMap = new Map([
        ["channel1", { id: "channel1", name: "general" }],
        ["channel2", { id: "channel2", name: "announcements" }],
    ]);

    // Add Collection-like methods to Map
    (channelsMap as any).find = function (predicate: (value: any) => boolean) {
        for (const [_key, value] of this.entries()) {
            if (predicate(value)) {
                return value;
            }
        }
        return undefined;
    };

    (channelsMap as any).get = function (key: string) {
        return Map.prototype.get.call(this, key);
    };

    (channelsMap as any).has = function (key: string) {
        return Map.prototype.has.call(this, key);
    };

    return {
        id: "987654321",
        name: "Test Guild",
        channels: {
            cache: channelsMap,
        },
        members: {
            me: { id: "bot123" },
            cache: new Map(),
        },
        roles: {
            cache: new Map(),
        },
        ...overrides,
    };
}

// Helper to extract content from reply (checks both content and embeds).
// The command sends errors/successes as embeds (description) and direct results as content.
function getReplyContent(reply: any): string {
    if (reply.content) return reply.content;
    if (reply.embeds?.[0]) {
        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        return embedData.description || "";
    }
    return "";
}

// COMMAND_EVENT_JSON_ERROR_LIST passes the individual error messages as interpolation args, which
// the key-echoing mock drops, collapsing every failure to one string. Use the real language.
function realCtx(interaction: any, permLevel: number) {
    return createCommandContext({ interaction, language: createRealLanguage(), permLevel });
}

describe("Event", () => {
    let mongoClient: MongoClient;

    before(async () => {
        // Initialize cache with MongoDB testcontainer
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should reject create command when missing required name field", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", day: "01/01/2027", time: "12:00" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("Invalid or missing event name"), `Expected the missing-name error, got: ${content}`);
    });

    it("should reject create command when missing required day field", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", time: "12:00" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("Missing event day"), `Expected the missing-day error, got: ${content}`);
    });

    it("should reject create command when missing required time field", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", day: "01/01/2027" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("Missing event time"), `Expected the missing-time error, got: ${content}`);
    });

    it("should reject invalid date format (MM/DD/YYYY instead of DD/MM/YYYY)", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", day: "13/31/2027", time: "12:00" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        // The specific invalid day is echoed back so the user can see what was rejected.
        assert.ok(content.includes("Invalid Day (13/31/2027)"), `Expected the invalid-day error, got: ${content}`);
    });

    it("should reject invalid time format (not HH:MM)", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", day: "01/01/2027", time: "25:00" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("Invalid time (25:00)"), `Expected the invalid-time error, got: ${content}`);
    });

    it("should reject event creation with date in the past", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", day: "01/01/2020", time: "12:00" },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("in the past"), `Expected the past-date error, got: ${content}`);
    });

    it("should enforce GUILD_ADMIN permission for create subcommand", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "create", name: "testEvent", day: "01/01/2027", time: "12:00" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("not an admin"), `Expected the admin-permission error, got: ${content}`);
    });

    it("should enforce GUILD_ADMIN permission for delete subcommand", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "delete", name: "testEvent" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("not an admin"), `Expected the admin-permission error, got: ${content}`);
    });

    it("should enforce GUILD_ADMIN permission for edit subcommand", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "edit", event_name: "testEvent", name: "newName" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("not an admin"), `Expected the admin-permission error, got: ${content}`);
    });

    it("should enforce GUILD_ADMIN permission for trigger subcommand", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "trigger", name: "testEvent" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("not an admin"), `Expected the admin-permission error, got: ${content}`);
    });

    it("should allow view subcommand without GUILD_ADMIN permission", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "view" },
        });
        eventSocket.getEventsByGuild = async () => [];

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        // View proceeds past the admin gate (no permission error) and reaches the no-events message.
        assert.ok(!content.includes("not an admin"), "View should not require GUILD_ADMIN");
        assert.ok(content.includes("could not find any events"), `Expected the no-events message, got: ${content}`);
    });

    describe("view shows mentions as Discord renders them, without pinging anyone", () => {
        const MENTIONS = "Raid now <@555555555555555555> <@&666666666666666666> in <#777777777777777777> @everyone";
        const storedEvent = {
            name: "raidcall",
            eventDT: Date.now() + 3_600_000,
            message: MENTIONS,
            channel: "",
            countdown: false,
            repeatDay: "0",
        } as any;

        function assertRenderedWithoutPings(reply: any) {
            assert.ok(reply.content.includes(MENTIONS), `Expected the mentions left intact, got: ${reply.content}`);
            assert.ok(!reply.content.includes("```"), "A code block would stop the mentions rendering as names");
            assert.deepStrictEqual(reply.allowedMentions, { parse: [] }, "Expected every ping suppressed");
        }

        it("for a single event", async () => {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: { _subcommand: "view", name: "raidcall" },
            });
            eventSocket.getEventByName = async () => storedEvent;

            await new Event().run(realCtx(interaction, 0));

            assertRenderedWithoutPings((interaction as any)._getReplies()[0]);
        });

        it("for the event list", async () => {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: { _subcommand: "view" },
            });
            eventSocket.getEventsByGuild = async () => [storedEvent];

            await new Event().run(realCtx(interaction, 0));

            assertRenderedWithoutPings((interaction as any)._getReplies()[0]);
        });
    });

    it("should reject createjson with invalid JSON", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "createjson", json: "not valid json" },
        });

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("valid json"), `Expected the bad-JSON error, got: ${content}`);
    });

    it("should reject createjson JSON without array or object wrapper", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "createjson", json: '```"name": "test"```' },
        });

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("surrounded by square brackets"), `Expected the JSON-wrapper error, got: ${content}`);
    });

    it("should reject event with invalid repeat format", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2027",
                time: "12:00",
                repeat: "invalid",
                channel: { id: "channel1", name: "general" },
            },
        });
        eventSocket.addEvents = async () => [];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("The repeat is in the wrong format"), `Expected the invalid-repeat error, got: ${content}`);
    });

    it("should reject view with both name and filter specified", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "view", name: "testEvent", filter: "someFilter" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("both name and filter"), `Expected the name+filter error, got: ${content}`);
    });

    it("should reject command when not in guild context", async () => {
        const interaction = createMockInteraction({
            guild: null,
            optionsData: { _subcommand: "view" },
        });

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("unavailable via private message"), `Expected the DM-usage error, got: ${content}`);
    });

    it("should accept valid repeat format (DDdHHhMMm) and create the event", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testRepeatEvent",
                day: "01/01/2027",
                time: "12:00",
                repeat: "7d0h0m", // Weekly repeat
                channel: { id: "channel1", name: "general" },
            },
        });
        eventSocket.addEvents = async (_guildId, events) => [{ success: true, event: events[0], error: null }];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(!content.includes("wrong format"), "A valid repeat format should not trip the repeat validation");
        assert.ok(content.includes("created for"), `Expected the created confirmation, got: ${content}`);
    });

    it("should accept valid time formats (HH:MM in 24hr) and create the event", async () => {
        const validTimes = ["00:00", "12:00", "23:59"];

        for (const time of validTimes) {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: {
                    _subcommand: "create",
                    name: `testEvent_${time.replace(":", "")}`,
                    day: "01/01/2027",
                    time: time,
                    channel: { id: "channel1", name: "general" },
                },
            });
            eventSocket.addEvents = async (_guildId, events) => [{ success: true, event: events[0], error: null }];

            await new Event().run(realCtx(interaction, 10));

            const content = getReplyContent((interaction as any)._getReplies()[0]);
            assert.ok(!content.includes("Invalid time"), `Time ${time} should be valid`);
            assert.ok(content.includes("created for"), `Time ${time} should create the event, got: ${content}`);
        }
    });

    it("should accept valid date formats (DD/MM/YYYY) and create the event", async () => {
        const validDates = ["01/01/2027", "31/12/2027", "15/06/2027"];

        for (const day of validDates) {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: {
                    _subcommand: "create",
                    name: `testEvent_${day.replace(/\//g, "")}`,
                    day: day,
                    time: "12:00",
                    channel: { id: "channel1", name: "general" },
                },
            });
            eventSocket.addEvents = async (_guildId, events) => [{ success: true, event: events[0], error: null }];

            await new Event().run(realCtx(interaction, 10));

            const content = getReplyContent((interaction as any)._getReplies()[0]);
            assert.ok(!content.includes("Invalid Day"), `Date ${day} should be valid`);
            assert.ok(content.includes("created for"), `Date ${day} should create the event, got: ${content}`);
        }
    });

    it("should view events when no events exist", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "view" },
        });
        eventSocket.getEventsByGuild = async () => [];

        await new Event().run(realCtx(interaction, 0));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("could not find any events"), `Expected the no-events message, got: ${content}`);
    });

    it("should handle successful event creation", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "validEvent",
                day: "01/06/2027",
                time: "15:30",
                message: "Test event message",
                channel: { id: "channel1", name: "general" },
            },
        });
        eventSocket.addEvents = async (_guildId, events) => [{ success: true, event: events[0], error: null }];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        // The confirmation names the created event.
        assert.ok(content.includes("validEvent"), `Expected the event name in the confirmation, got: ${content}`);
        assert.ok(content.includes("created for"), `Expected the created confirmation, got: ${content}`);
    });

    it("should handle failed event creation from eventSocket", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "failEvent",
                day: "01/06/2027",
                time: "15:30",
                channel: { id: "channel1", name: "general" },
            },
        });
        eventSocket.addEvents = async () => [{ success: false, event: null, error: "Database error" }];

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        // Validation passed (channel present), so the socket failure surfaces with the event name + reason.
        assert.ok(content.includes("failEvent"), `Expected the failing event name, got: ${content}`);
        assert.ok(content.includes("Database error"), `Expected the socket error reason, got: ${content}`);
    });

    it("should handle successful event deletion", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "delete", name: "eventToDelete" },
        });
        eventSocket.deleteEvent = async () => ({ success: true, error: null });

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        assert.ok(content.includes("Deleted event: eventToDelete"), `Expected the deletion confirmation, got: ${content}`);
    });

    it("should handle failed event deletion", async () => {
        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: { _subcommand: "delete", name: "nonExistentEvent" },
        });
        eventSocket.deleteEvent = async () => ({ success: false, error: "Event not found" });

        await new Event().run(realCtx(interaction, 10));

        const content = getReplyContent((interaction as any)._getReplies()[0]);
        // The socket's error reason is surfaced verbatim to the user.
        assert.ok(content.includes("Event not found"), `Expected the deletion failure reason, got: ${content}`);
    });

    describe("create against stored events", () => {
        beforeEach(clearEventGuild);
        after(clearEventGuild);

        const createIn = (name: string) =>
            createMockInteraction({
                guild: createMockGuild({ id: EV_GUILD }) as any,
                optionsData: { _subcommand: "create", name, day: "01/06/2030", time: "12:00", channel: { id: "channel1" } },
            });

        it("rejects a 51st event", async () => {
            await setEvents({
                guildId: EV_GUILD,
                evArrOut: Array.from({ length: 50 }, (_, ix) => storedEvent({ name: `ev${ix}` })),
            });
            const interaction = createIn("oneTooMany");

            await new Event().run(realCtx(interaction, 10));

            assert.ok(getReplyContent((interaction as any)._getReplies()[0]).includes("only have up to 50 events"));
        });

        it("rejects a name that is already in use", async () => {
            await setEvents({ guildId: EV_GUILD, evArrOut: [storedEvent({ name: "taken" })] });
            const interaction = createIn("taken");

            await new Event().run(realCtx(interaction, 10));

            assert.ok(getReplyContent((interaction as any)._getReplies()[0]).includes("already an event with this name"));
        });
    });

    describe("create validation", () => {
        async function createWith(options: Record<string, unknown>) {
            let added: GuildConfigEvent[] | null = null;
            eventSocket.addEvents = async (_guildId, events) => {
                added = events;
                return [{ success: true, event: events[0], error: null }];
            };
            const interaction = createMockInteraction({
                guild: createMockGuild({ id: EV_GUILD }) as any,
                optionsData: { _subcommand: "create", name: "repeatTest", day: "01/06/2030", time: "12:00", ...options },
            });
            await new Event().run(realCtx(interaction, 10));
            return { added: added as GuildConfigEvent[] | null, content: getReplyContent((interaction as any)._getReplies()[0]) };
        }

        for (const [repeatday, expected] of [
            ["[1,2]", [1, 2]],
            ["1,3", [1, 3]],
        ] as const) {
            it(`stores repeatday ${repeatday} as a day list`, async () => {
                const { added } = await createWith({ repeatday, channel: { id: "channel1" } });

                assert.deepStrictEqual(added?.[0].repeatDays, expected);
            });
        }

        for (const [repeatday, error] of [
            ["[0,2]", "All numbers must be above 0"],
            ["0,1", "All numbers must be above 0"],
            ["abc", "RepeatDay must be in the form of an array"],
        ]) {
            it(`rejects repeatday ${repeatday}`, async () => {
                const { added, content } = await createWith({ repeatday, channel: { id: "channel1" } });

                assert.strictEqual(added, null, "nothing should be sent to the event service");
                assert.ok(content.includes(error), content);
            });
        }

        it("parses an interval repeat into days, hours and minutes", async () => {
            const { added } = await createWith({ repeat: "1d2h3m", channel: { id: "channel1" } });

            assert.deepStrictEqual(added?.[0].repeat, { repeatDay: 1, repeatHour: 2, repeatMin: 3 });
        });

        it("requires a channel when the guild has no announce channel", async () => {
            const { content } = await createWith({});

            assert.ok(content.includes("You need to configure a channel"), content);
        });
    });

    describe("createjson", () => {
        const jsonEvent = (overrides: Record<string, unknown> = {}) => ({
            name: "jsonEv",
            day: "01/06/2030",
            time: "12:00",
            channel: "channel1",
            ...overrides,
        });

        async function createJson(json: string) {
            let added: GuildConfigEvent[] | null = null;
            eventSocket.addEvents = async (_guildId, events) => {
                added = events;
                return events.map((event, ix) =>
                    ix === 1 ? { success: false, event, error: "Database error" } : { success: true, event, error: null },
                );
            };
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: { _subcommand: "createjson", json },
            });
            await new Event().run(realCtx(interaction, 10));
            return { added: added as GuildConfigEvent[] | null, reply: (interaction as any)._getReplies()[0] };
        }

        it("adds every event and logs which ones the service accepted", async () => {
            const json = `\`\`\`${JSON.stringify([jsonEvent({ name: "first" }), jsonEvent({ name: "second" })])}\`\`\``;

            const { added, reply } = await createJson(json);

            assert.deepStrictEqual(
                added?.map((e) => e.name),
                ["first", "second"],
            );
            const [success, failures] = reply.embeds[0].fields;
            assert.ok(success.value.includes("Event `first` created for"), success.value);
            assert.strictEqual(failures.value, "Failed to create event `second` Database error");
        });

        it("accepts a single object and reads channelID", async () => {
            const { added } = await createJson(JSON.stringify({ ...jsonEvent({ channel: undefined }), channelID: "channel2" }));

            assert.strictEqual(added?.[0].channel, "channel2");
        });

        it("adds nothing and lists each event's errors when any event is invalid", async () => {
            const json = JSON.stringify([
                jsonEvent({ name: "dup" }),
                jsonEvent({ name: "dup" }),
                jsonEvent({ name: "long", message: "x".repeat(1001) }),
                jsonEvent({ name: "both", repeat: "1d0h0m", repeatDay: "[1]" }),
            ]);

            const { added, reply } = await createJson(json);

            assert.strictEqual(added, null);
            assert.ok(reply.content.includes("none have been added"), reply.content);
            assert.ok(reply.content.includes("Event #1 valid"), reply.content);
            assert.ok(reply.content.includes("Event #2    ERROR(s)\n* You cannot make 2 events with the same name"), reply.content);
            assert.ok(reply.content.includes("maximum message length of 1000 characters, this one is 1001"), reply.content);
            assert.ok(reply.content.includes("You cannot have both repeat & repeatDay"), reply.content);
        });
    });

    describe("view one event", () => {
        async function viewOne(event: GuildConfigEvent | null, minimal = false) {
            eventSocket.getEventByName = async () => event;
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: { _subcommand: "view", name: "lookup", minimal },
            });
            await new Event().run(realCtx(interaction, 0));
            return getReplyContent((interaction as any)._getReplies()[0]);
        }

        it("shows a cached channel as a mention, the day schedule and the message", async () => {
            const content = await viewOne(storedEvent({ name: "weekly", repeatDays: [1, 2], message: "hello" }));

            assert.ok(content.startsWith(`**weekly** \nEvent Time: <t:${FUTURE_DT / 1000}:f>\n`), content);
            assert.ok(content.includes("Sending on channel: <#channel1>"), content);
            assert.ok(content.includes("Repeat schedule: 1, 2"), content);
            assert.ok(content.includes("Event Message: \nhello"), content);
        });

        it("shows an uncached channel raw and an interval repeat, and hides the message when minimal", async () => {
            const event = storedEvent({ channel: "gone", repeat: { repeatDay: 1, repeatHour: 2, repeatMin: 3 }, message: "hidden" });

            const content = await viewOne(event, true);

            assert.ok(content.includes("Sending on channel: gone"), content);
            assert.ok(content.includes("Repeating every 1 days, 2 hours, and 3 minutes"), content);
            assert.ok(!content.includes("hidden"), content);
        });

        it("says when the event does not exist", async () => {
            const content = await viewOne(null);

            assert.strictEqual(content, "Sorry, but I cannot find the event `lookup`");
        });
    });

    describe("view the event list", () => {
        beforeEach(clearEventGuild);
        after(clearEventGuild);

        async function viewList(events: GuildConfigEvent[], options: Record<string, unknown> = {}) {
            eventSocket.getEventsByGuild = async () => events;
            const channelSends: string[] = [];
            const interaction = createMockInteraction({
                guild: createMockGuild({ id: EV_GUILD }) as any,
                optionsData: { _subcommand: "view", ...options },
            });
            (interaction as any).channel = {
                isSendable: () => true,
                send: async ({ content }: { content: string }) => channelSends.push(content),
            };
            await new Event().run(realCtx(interaction, 0));
            return { replies: (interaction as any)._getReplies().map(getReplyContent) as string[], channelSends };
        }

        it("passes each filter word to the event service", async () => {
            let filterWords: string[] = [];
            eventSocket.getEventsByFilter = async (_guildId, words) => {
                filterWords = words;
                return [storedEvent({ name: "raid" })];
            };
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: { _subcommand: "view", filter: "raid tw" },
            });

            await new Event().run(realCtx(interaction, 0));

            assert.deepStrictEqual(filterWords, ["raid", "tw"]);
            assert.ok(getReplyContent((interaction as any)._getReplies()[0]).includes("**raid**"));
        });

        it("sorts by time and shows the requested page of five", async () => {
            const events = [7, 3, 1, 6, 2, 5, 4].map((n) => storedEvent({ name: `ev${n}`, eventDT: FUTURE_DT + n * 60_000 }));

            const { replies } = await viewList(events, { page_num: 2 });

            assert.strictEqual(replies.length, 1);
            assert.ok(replies[0].includes("(7 total events)"), replies[0]);
            assert.ok(replies[0].indexOf("**ev6**") < replies[0].indexOf("**ev7**"), replies[0]);
            assert.ok(!replies[0].includes("**ev5**"), "page 2 should start at the sixth event");
        });

        it("continues a long schedule in the channel when pages are off", async () => {
            const events = [1, 2, 3, 4, 5].map((n) => storedEvent({ name: `long${n}`, message: "m".repeat(900) }));

            const { replies, channelSends } = await viewList(events);

            assert.strictEqual(replies.length, 1);
            assert.ok(replies[0].startsWith("Here's your server's Event Schedule \n(5 total events): \n"), replies[0].slice(0, 80));
            assert.ok(channelSends.length > 0, "the rest of the schedule should go to the channel");
            assert.ok(channelSends.join("").includes("**long5**"));
        });

        it("sends only the first chunk when pages are on", async () => {
            await setGuildSettings({ guildId: EV_GUILD, settings: { ...defaultGuildSettings, useEventPages: true } });
            const events = [1, 2, 3, 4, 5].map((n) => storedEvent({ name: `long${n}`, message: "m".repeat(900) }));

            const { replies, channelSends } = await viewList(events);

            assert.strictEqual(replies.length, 1);
            assert.ok(replies[0].includes("(5 total events)"), replies[0].slice(0, 120));
            assert.deepStrictEqual(channelSends, []);
        });
    });

    describe("trigger", () => {
        beforeEach(clearEventGuild);
        after(clearEventGuild);

        async function trigger(event: GuildConfigEvent | null, { failSend = false } = {}) {
            eventSocket.getEventByName = async () => event;
            const sent: { channel: string; content: string }[] = [];
            const interaction = createMockInteraction({
                guild: createSendableGuild(sent, { failSend }) as any,
                optionsData: { _subcommand: "trigger", name: "callout" },
            });
            await new Event().run(realCtx(interaction, 10));
            return { sent, reply: (interaction as any)._getReplies()[0] };
        }

        it("announces in the event's channel and confirms privately", async () => {
            const { sent, reply } = await trigger(storedEvent({ name: "callout", channel: "channel1", message: "Raid time" }));

            assert.deepStrictEqual(sent, [{ channel: "channel1", content: "**callout**\nRaid time" }]);
            assert.strictEqual(reply.content, "Successfully triggered callout");
            assert.ok(reply.flags, "the confirmation should be ephemeral");
        });

        it("finds the event's channel by name", async () => {
            const { sent } = await trigger(storedEvent({ name: "callout", channel: "announce" }));

            assert.strictEqual(sent[0]?.channel, "channel2");
        });

        it("falls back to the guild's announce channel", async () => {
            await setGuildSettings({ guildId: EV_GUILD, settings: { ...defaultGuildSettings, announceChan: "announce" } });

            const { sent } = await trigger(storedEvent({ name: "callout", channel: null }));

            assert.strictEqual(sent[0]?.channel, "channel2");
        });

        it("reports a failed send", async () => {
            const { reply } = await trigger(storedEvent({ name: "callout" }), { failSend: true });

            assert.strictEqual(reply.content, "Broke when trying to trigger *callout*.\nIf this continues, please report it.");
        });
    });

    describe("edit", () => {
        beforeEach(clearEventGuild);
        after(clearEventGuild);

        async function edit(options: Record<string, unknown>) {
            const interaction = createMockInteraction({
                guild: createMockGuild({ id: EV_GUILD }) as any,
                optionsData: { _subcommand: "edit", event_name: "original", ...options },
            });
            await new Event().run(realCtx(interaction, 10));
            const reply = (interaction as any)._getReplies()[0];
            const embed = reply.embeds?.[0]?.data ?? reply.embeds?.[0];
            return { content: getReplyContent(reply), title: embed?.author?.name, saved: await getGuildEvents({ guildId: EV_GUILD }) };
        }

        it("saves the new name and message and lists each change in code", async () => {
            await setEvents({ guildId: EV_GUILD, evArrOut: [storedEvent({ name: "original", message: "old msg" })] });

            const { content, title, saved } = await edit({ name: "renamed", message: "new msg" });

            assert.strictEqual(title, "Success");
            assert.ok(content.includes("- Updated **Name** from `original` to `renamed`"), content);
            assert.ok(content.includes("- Updated **Message** from `old msg` to `new msg`"), content);
            assert.ok(!content.includes("EventDT"), `an unchanged time should not be listed: ${content}`);
            assert.deepStrictEqual(
                saved.map((e) => [e.name, e.message, e.eventDT]),
                [["renamed", "new msg", FUTURE_DT]],
            );
        });

        it("lists a channel change as mentions", async () => {
            await setEvents({ guildId: EV_GUILD, evArrOut: [storedEvent({ name: "original", channel: "123456789012345678" })] });

            const { content } = await edit({ name: "moved", channel: { id: "223456789012345678" } });

            assert.ok(content.includes("- Updated **Channel** from <#123456789012345678> to <#223456789012345678>"), content);
        });

        it("keeps an existing interval repeat or day schedule", async () => {
            await setEvents({
                guildId: EV_GUILD,
                evArrOut: [
                    storedEvent({ name: "original", repeat: { repeatDay: 1, repeatHour: 0, repeatMin: 30 } }),
                    storedEvent({ name: "daily", repeatDays: [2, 3] }),
                ],
            });

            await edit({ name: "renamedInterval" });
            await edit({ event_name: "daily", name: "renamedDaily" });

            const saved = await getGuildEvents({ guildId: EV_GUILD });
            const byName = new Map(saved.map((e) => [e.name, e]));
            assert.deepStrictEqual(byName.get("renamedInterval")?.repeat, { repeatDay: 1, repeatHour: 0, repeatMin: 30 });
            assert.deepStrictEqual(byName.get("renamedDaily")?.repeatDays, [2, 3]);
        });

        it("replaces the repeat with a new interval or day list", async () => {
            await setEvents({
                guildId: EV_GUILD,
                evArrOut: [storedEvent({ name: "original", repeatDays: [1] }), storedEvent({ name: "second" })],
            });

            await edit({ name: "nowInterval", repeat: "0d6h0m" });
            await edit({ event_name: "second", name: "nowDays", repeatday: "4,5" });

            const byName = new Map((await getGuildEvents({ guildId: EV_GUILD })).map((e) => [e.name, e]));
            assert.deepStrictEqual(byName.get("nowInterval")?.repeat, { repeatDay: 0, repeatHour: 6, repeatMin: 0 });
            assert.deepStrictEqual(byName.get("nowDays")?.repeatDays, [4, 5]);
        });

        it("rejects an invalid new value and saves nothing", async () => {
            await setEvents({ guildId: EV_GUILD, evArrOut: [storedEvent({ name: "original" })] });

            const { content, saved } = await edit({ name: "renamed", time: "99:99" });

            assert.ok(content.startsWith("There was an issue with that:"), content);
            assert.ok(content.includes("Invalid time (99:99)"), content);
            assert.deepStrictEqual(
                saved.map((e) => e.name),
                ["original"],
            );
        });

        it("says when the event does not exist", async () => {
            const { content } = await edit({ name: "renamed" });

            assert.strictEqual(content, "Sorry, but I cannot find the event `original`");
        });
    });
});
