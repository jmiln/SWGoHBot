import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import cache from "../../modules/cache.ts";
import eventSocket from "../../modules/eventSocket.ts";
import Event from "../../slash/event.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createRealLanguage } from "../mocks/index.ts";

// Helper to create a mock guild with channels
function createMockGuild(overrides = {}) {
    const channelsMap = new Map([
        ["channel1", { id: "channel1", name: "general" }],
        ["channel2", { id: "channel2", name: "announcements" }],
    ]);

    // Add Collection-like methods to Map
    (channelsMap as any).find = function (predicate: (value: any) => boolean) {
        for (const [key, value] of this.entries()) {
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
    if (reply.embeds && reply.embeds[0]) {
        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        return embedData.description || "";
    }
    return "";
}

// The command wraps per-event validation failures in COMMAND_EVENT_JSON_ERROR_LIST, which passes the
// individual error messages as interpolation args. The key-echoing mock drops those args, so every
// validation failure would collapse to the same string. Use the real language so the specific
// sub-error text actually reaches the reply and the assertions below can tell the branches apart.
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
});
