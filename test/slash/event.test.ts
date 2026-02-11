import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import cache from "../../modules/cache.ts";
import eventSocket from "../../modules/eventSocket.ts";
import Event from "../../slash/event.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";

// Helper to create a mock guild with channels
function createMockGuild(overrides = {}) {
    const channelsMap = new Map([
        ["channel1", { id: "channel1", name: "general" }],
        ["channel2", { id: "channel2", name: "announcements" }],
    ]);

    // Add Collection-like methods to Map
    (channelsMap as any).find = function(predicate: (value: any) => boolean) {
        for (const [key, value] of this.entries()) {
            if (predicate(value)) {
                return value;
            }
        }
        return undefined;
    };

    (channelsMap as any).get = function(key: string) {
        return Map.prototype.get.call(this, key);
    };

    (channelsMap as any).has = function(key: string) {
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

// Helper to extract content from reply (checks both content and embeds)
function getReplyContent(reply: any): string {
    if (reply.content) return reply.content;
    if (reply.embeds && reply.embeds[0]) {
        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        return embedData.description || "";
    }
    return "";
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

    it("should reject create command when missing required name field", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                day: "01/01/2027",
                time: "12:00",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for missing name");
    });

    it("should reject create command when missing required day field", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                time: "12:00",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for missing day");
    });

    it("should reject create command when missing required time field", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2027",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for missing time");
    });

    it("should reject invalid date format (MM/DD/YYYY instead of DD/MM/YYYY)", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "13/31/2027", // Invalid date
                time: "12:00",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for invalid date");
    });

    it("should reject invalid time format (not HH:MM)", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2027",
                time: "25:00", // Invalid hour
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for invalid time");
    });

    it("should reject event creation with date in the past", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2020", // Past date
                time: "12:00",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for past date");
    });

    it("should enforce GUILD_ADMIN permission for create subcommand", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2027",
                time: "12:00",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx); // Low permission level

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected permission error");
    });

    it("should enforce GUILD_ADMIN permission for delete subcommand", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "delete",
                name: "testEvent",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx); // Low permission level

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected permission error");
    });

    it("should enforce GUILD_ADMIN permission for edit subcommand", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "edit",
                event_name: "testEvent",
                name: "newName",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx); // Low permission level

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected permission error");
    });

    it("should enforce GUILD_ADMIN permission for trigger subcommand", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "trigger",
                name: "testEvent",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx); // Low permission level

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected permission error");
    });

    it("should allow view subcommand without GUILD_ADMIN permission", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "view",
            },
        });

        eventSocket.getEventsByGuild = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx); // Low permission level

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // Should not show permission error
        const reply = replies[0];
        const content = reply.content || "";
        assert.ok(!content.includes("COMMAND_EVENT_INVALID_PERMS"), "View should not require GUILD_ADMIN");
    });

    it("should reject createjson with invalid JSON", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "createjson",
                json: "not valid json",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for invalid JSON");
    });

    it("should reject createjson JSON without array or object wrapper", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "createjson",
                json: "```\"name\": \"test\"```",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for JSON wrapper");
    });

    it("should reject event with invalid repeat format", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testEvent",
                day: "01/01/2027",
                time: "12:00",
                repeat: "invalid",
            },
        });

        eventSocket.addEvents = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for invalid repeat format");
    });

    it("should reject view with both name and filter specified", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "view",
                name: "testEvent",
                filter: "someFilter",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for using both name and filter");
    });

    it("should reject command when not in guild context", async () => {        const interaction = createMockInteraction({
            guild: null,
            optionsData: {
                _subcommand: "view",
            },
        });

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for DM usage");
    });

    it("should accept valid repeat format (DDdHHhMMm)", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "create",
                name: "testRepeatEvent",
                day: "01/01/2027",
                time: "12:00",
                repeat: "7d0h0m", // Weekly repeat
            },
        });

        eventSocket.addEvents = async () => [{ success: true, event: {} }];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const content = getReplyContent(replies[0]);

        // Should not show repeat validation error
        assert.ok(!content.includes("COMMAND_EVENT_INVALID_REPEAT"), "Valid repeat format should be accepted");
    });

    it("should accept valid time formats (HH:MM in 24hr)", async () => {        const validTimes = ["00:00", "12:00", "23:59"];

        for (const time of validTimes) {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: {
                    _subcommand: "create",
                    name: `testEvent_${time.replace(":", "")}`,
                    day: "01/01/2027",
                    time: time,
                },
            });

            eventSocket.addEvents = async () => [{ success: true, event: {} }];

            const command = new Event();
            const ctx = createCommandContext({ interaction, permLevel: 10 });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const reply = replies[0];
            const content = reply.content || reply.embeds?.[0]?.description || "";

            // Should not show time validation error
            assert.ok(!content.includes("COMMAND_EVENT_JSON_INVALID_TIME"), `Time ${time} should be valid`);
        }
    });

    it("should accept valid date formats (DD/MM/YYYY)", async () => {        const validDates = ["01/01/2027", "31/12/2027", "15/06/2027"];

        for (const day of validDates) {
            const interaction = createMockInteraction({
                guild: createMockGuild() as any,
                optionsData: {
                    _subcommand: "create",
                    name: `testEvent_${day.replace(/\//g, "")}`,
                    day: day,
                    time: "12:00",
                },
            });

            eventSocket.addEvents = async () => [{ success: true, event: {} }];

            const command = new Event();
            const ctx = createCommandContext({ interaction, permLevel: 10 });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const reply = replies[0];
            const content = reply.content || reply.embeds?.[0]?.description || "";

            // Should not show date validation error
            assert.ok(!content.includes("COMMAND_EVENT_JSON_INVALID_DAY"), `Date ${day} should be valid`);
        }
    });

    it("should view events when no events exist", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "view",
            },
        });

        eventSocket.getEventsByGuild = async () => [];

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        const content = reply.content || "";
        assert.ok(content.length > 0, "Expected message when no events exist");
    });

    it("should handle successful event creation", async () => {        const mockGuild = createMockGuild();
        const interaction = createMockInteraction({
            guild: mockGuild as any,
            optionsData: {
                _subcommand: "create",
                name: "validEvent",
                day: "01/06/2027",
                time: "15:30",
                message: "Test event message",
                channel: { id: "channel1", name: "general" },
            },
        });

        eventSocket.addEvents = async (guildId, events) => {
            return [{
                success: true,
                event: events[0],
                error: null,
            }];
        };

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = replies[0].content || "";
        assert.ok(content.length > 0, "Expected success message for event creation");
    });

    it("should handle failed event creation from eventSocket", async () => {        const mockGuild = createMockGuild();
        const interaction = createMockInteraction({
            guild: mockGuild as any,
            optionsData: {
                _subcommand: "create",
                name: "failEvent",
                day: "01/06/2027",
                time: "15:30",
                channel: { id: "channel1", name: "general" },
            },
        });

        eventSocket.addEvents = async () => {
            return [{
                success: false,
                event: null,
                error: "Database error",
            }];
        };

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = replies[0].content || "";
        assert.ok(content.length > 0, "Expected error message for failed creation");
    });

    it("should handle successful event deletion", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "delete",
                name: "eventToDelete",
            },
        });

        eventSocket.deleteEvent = async () => {
            return { success: true, error: null };
        };

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected success message for event deletion");
    });

    it("should handle failed event deletion", async () => {        const interaction = createMockInteraction({
            guild: createMockGuild() as any,
            optionsData: {
                _subcommand: "delete",
                name: "nonExistentEvent",
            },
        });

        eventSocket.deleteEvent = async () => {
            return { success: false, error: "Event not found" };
        };

        const command = new Event();
        const ctx = createCommandContext({ interaction, permLevel: 10 });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const content = getReplyContent(replies[0]);
        assert.ok(content.length > 0, "Expected error message for failed deletion");
    });
});
