import assert from "node:assert/strict";
import test from "node:test";
import Event from "../../slash/event.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Event Command", () => {
    test("run() should error when used in DMs", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: null,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 });

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.strictEqual(replyCalls[0].embeds[0].color, 16711680, "Should be red color (error)");
        assert.match(replyCalls[0].embeds[0].description, /not available in DMs/, "Should mention DMs");
    });

    test("run() should error when guild ID is missing", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: { id: null } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 });

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /trouble accessing.*guild/, "Should mention guild access issue");
    });

    test("run() should require admin permission for create action", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "create",
                getString: (name: string) => {
                    if (name === "name") return "TestEvent";
                    if (name === "day") return "31/12/2026";
                    if (name === "time") return "12:00";
                    return null;
                },
                getBoolean: () => false,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_INVALID_PERMS/, "Should mention permission error");
    });

    test("run() should require admin permission for delete action", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "delete",
                getString: () => "TestEvent",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_INVALID_PERMS/, "Should mention permission error");
    });

    test("run() should require admin permission for edit action", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "edit",
                getString: () => "TestEvent",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_INVALID_PERMS/, "Should mention permission error");
    });

    test("run() should require admin permission for trigger action", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "trigger",
                getString: () => "TestEvent",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_INVALID_PERMS/, "Should mention permission error");
    });

    test("run() should require admin permission for createjson action", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "createjson",
                getString: () => '{"name":"test","day":"31/12/2026","time":"12:00"}',
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_INVALID_PERMS/, "Should mention permission error");
    });

    test("run() should allow view action for non-admin users", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
            socket: {
                emit: async (event: string, data: any, callback: any) => {
                    if (event === "getEventsByGuild") {
                        callback([]);
                    }
                },
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "view",
                getString: () => null,
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 }); // Level 0 = not admin

        // View should be accessible to everyone, so it shouldn't error with permission issues
        assert.ok(replyCalls.length > 0, "Should have called reply");
    });

    test("run() should error when too many events exist (50+ events)", async () => {
        // Create 50 mock events
        const mockEvents = Array.from({ length: 50 }, (_, i) => ({
            name: `Event${i}`,
            eventDT: Date.now() + 1000000,
            message: "Test",
            channel: "123",
            countdown: false,
            repeat: { repeatDay: 0, repeatHour: 0, repeatMin: 0 },
            repeatDays: [],
        }));

        const bot = createMockBot({
            cache: {
                get: async () => [{ events: mockEvents }],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "announcements" }),
            } as any,
            socket: {
                emit: async (event: string, data: any, callback: any) => {
                    // Should not reach here due to event limit validation
                    callback([{ success: false, error: "Should not reach socket emit" }]);
                },
            } as any,
        });
        const replyCalls: any[] = [];

        const mockChannelsCache = new Map();
        mockChannelsCache.set("123", { id: "123", name: "announcements" });
        (mockChannelsCache as any).find = (fn: any) => {
            for (const [, value] of mockChannelsCache) {
                if (fn(value)) return value;
            }
            return mockChannelsCache.get("123");
        };

        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "create",
                getString: (name: string) => {
                    if (name === "name") return "NewEvent";
                    if (name === "day") return "31/12/2026";
                    if (name === "time") return "12:00";
                    return null;
                },
                getBoolean: () => false,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            channel: { id: "123", name: "test-channel" } as any,
            guild: {
                id: "123456789",
                channels: {
                    cache: mockChannelsCache,
                },
            } as any,
            guildSettings: {
                timezone: "America/Los_Angeles",
                announceChan: "announcements",
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_TOO_MANY_EVENTS/, "Should mention too many events");
    });

    test("run() should error when creating duplicate event name", async () => {
        const mockEvents = [
            {
                name: "ExistingEvent",
                eventDT: Date.now() + 1000000,
                message: "Test",
                channel: "123",
                countdown: false,
                repeat: { repeatDay: 0, repeatHour: 0, repeatMin: 0 },
                repeatDays: [],
            },
        ];

        const bot = createMockBot({
            cache: {
                get: async () => [{ events: mockEvents }],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "announcements" }),
            } as any,
            socket: {
                emit: async (event: string, data: any, callback: any) => {
                    // Should not reach here due to duplicate name validation
                    callback([{ success: false, error: "Should not reach socket emit" }]);
                },
            } as any,
        });
        const replyCalls: any[] = [];

        const mockChannelsCache = new Map();
        mockChannelsCache.set("123", { id: "123", name: "announcements" });
        (mockChannelsCache as any).find = (fn: any) => {
            for (const [, value] of mockChannelsCache) {
                if (fn(value)) return value;
            }
            return mockChannelsCache.get("123");
        };

        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "create",
                getString: (name: string) => {
                    if (name === "name") return "ExistingEvent"; // Duplicate name
                    if (name === "day") return "31/12/2026";
                    if (name === "time") return "12:00";
                    return null;
                },
                getBoolean: () => false,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            channel: { id: "123", name: "test-channel" } as any,
            guild: {
                id: "123456789",
                channels: {
                    cache: mockChannelsCache,
                },
            } as any,
            guildSettings: {
                timezone: "America/Los_Angeles",
                announceChan: "announcements",
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_JSON_EXISTS/, "Should mention duplicate event");
    });

    test("run() view should error when both name and filter are provided", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "view",
                getString: (name: string) => {
                    if (name === "name") return "TestEvent";
                    if (name === "filter") return "test filter";
                    return null;
                },
                getBoolean: () => false,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 0 });

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(
            replyCalls[0].embeds[0].description,
            /cannot use both name and filter/,
            "Should mention conflicting options"
        );
    });

    test("run() createjson should error on invalid JSON", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "createjson",
                getString: () => "not valid json",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /COMMAND_EVENT_JSON_BAD_JSON/, "Should mention bad JSON");
    });

    test("run() createjson should error when JSON is not array or object format", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "createjson",
                getString: () => "```just a string```",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.match(replyCalls[0].embeds[0].description, /Invalid json/, "Should mention invalid json format");
    });

    test("run() edit should error when event is not found", async () => {
        const bot = createMockBot({
            cache: {
                get: async () => [], // No events
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "123" }),
            } as any,
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "edit",
                getString: (name: string) => {
                    if (name === "event_name") return "NonExistentEvent";
                    return null;
                },
                getBoolean: () => null,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: new Map(),
                },
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.match(replyCalls[0].content, /COMMAND_EVENT_UNFOUND_EVENT/, "Should mention event not found");
    });

    test("run() should handle socket emit for create action", async () => {
        let socketEmitCalled = false;
        const bot = createMockBot({
            cache: {
                get: async () => [],
                getOne: async () => ({ timezone: "America/Los_Angeles", announceChan: "announcements" }),
            } as any,
            socket: {
                connected: true,
                emit: async (event: string, data: any, callback: any) => {
                    socketEmitCalled = true;
                    if (event === "addEvents") {
                        callback([{ success: true, error: null }]);
                    }
                },
            } as any,
        });

        const replyCalls: any[] = [];

        const mockChannelsCache = new Map();
        mockChannelsCache.set("123", { id: "123", name: "announcements" });
        (mockChannelsCache as any).find = (fn: any) => {
            for (const [, value] of mockChannelsCache) {
                if (fn(value)) return value;
            }
            return mockChannelsCache.get("123");
        };

        const interaction = createMockInteraction({
            options: {
                getSubcommand: () => "create",
                getString: (name: string) => {
                    if (name === "name") return "ValidEvent";
                    if (name === "day") return "31/12/2026";
                    if (name === "time") return "12:00";
                    return null;
                },
                getBoolean: () => false,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            guild: {
                id: "123456789",
                channels: {
                    cache: mockChannelsCache,
                },
            } as any,
            guildSettings: {
                timezone: "America/Los_Angeles",
                announceChan: "announcements",
            } as any,
        }) as any;

        const cmd = new Event(bot as any);
        await cmd.run(bot as any, interaction, { level: 10 }); // Admin level

        // Give time for async socket operations
        await new Promise((resolve) => setTimeout(resolve, 100));

        assert.ok(socketEmitCalled, "Socket emit should have been called");
    });
});
