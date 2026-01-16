import assert from "node:assert/strict";
import test from "node:test";
import GuildTickets from "../../slash/guildtickets.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("GuildTickets Command", () => {
    test("run() should error when user is not a patron", async () => {
        const bot = createMockBot({
            getPatronUser: async () => null,
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.ok(replyCalls.length > 0);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("COMMAND_ARENAALERT_PATREON_ONLY"),
            "Should show patreon only error",
        );
    });

    test("run() should error when user is patron but amount is less than 100 cents", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 50 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.ok(replyCalls.length > 0);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("COMMAND_ARENAALERT_PATREON_ONLY"),
            "Should show patreon only error for insufficient amount",
        );
    });

    test("run() should error when user data cannot be found", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => null,
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.ok(replyCalls.length > 0);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("couldn't find your data"),
            "Should show user data not found error",
        );
    });

    test("run() should display default settings when viewing with no guildTickets data", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123", username: "TestUser" },
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        const reply = replyCalls[0];
        assert.ok(reply.embeds?.[0]?.title?.includes("TestUser"), "Should show username in title");
        assert.ok(reply.embeds?.[0]?.description?.includes("OFF"), "Should show enabled as OFF");
        assert.ok(reply.embeds?.[0]?.description?.includes("N/A"), "Should show N/A for channel");
        assert.ok(reply.embeds?.[0]?.description?.includes("600"), "Should show default 600 tickets");
    });

    test("run() should display current settings when viewing", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: {
                        allycode: 123456789,
                        channel: "channel-123",
                        enabled: true,
                        showMax: true,
                        sortBy: "tickets",
                        tickets: 500,
                        updateType: "update",
                    },
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123", username: "TestUser" },
            options: {
                getSubcommand: () => "view",
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        const reply = replyCalls[0];
        assert.ok(reply.embeds?.[0]?.description?.includes("ON"), "Should show enabled as ON");
        assert.ok(reply.embeds?.[0]?.description?.includes("channel-123"), "Should show channel");
        assert.ok(reply.embeds?.[0]?.description?.includes("123456789"), "Should show allycode");
        assert.ok(reply.embeds?.[0]?.description?.includes("500"), "Should show tickets");
        assert.ok(reply.embeds?.[0]?.description?.includes("Tickets"), "Should show sortBy as Tickets");
    });

    test("run() should enable guild tickets when set to true", async () => {
        const updatedUser: any = { guildTickets: null };
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async (userId: string, user: any) => {
                    Object.assign(updatedUser, user);
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: (name: string) => (name === "enabled" ? true : null),
                getChannel: () => null,
                getString: () => null,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds?.[0]?.title?.includes("Settings updated"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Enabled: **true**"));
        assert.strictEqual(updatedUser.guildTickets.enabled, true);
    });

    test("run() should set channel when user has sufficient permissions", async () => {
        const updatedUser: any = { guildTickets: null };
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async (userId: string, user: any) => {
                    Object.assign(updatedUser, user);
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: (name: string) => (name === "channel" ? { id: "channel-456" } : null),
                getString: () => null,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds?.[0]?.title?.includes("Settings updated"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("channel-456"));
        assert.strictEqual(updatedUser.guildTickets.channel, "channel-456");
    });

    test("run() should error when setting channel without sufficient permissions", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: (name: string) => (name === "channel" ? { id: "channel-456" } : null),
                getString: () => null,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 2 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("COMMAND_ARENAWATCH_MISSING_PERM"),
            "Should show missing permission error",
        );
    });

    test("run() should set multiple options at once", async () => {
        const updatedUser: any = { guildTickets: null };
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async (userId: string, user: any) => {
                    Object.assign(updatedUser, user);
                },
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: (name: string) => {
                    if (name === "enabled") return true;
                    if (name === "show_max") return true;
                    return null;
                },
                getChannel: () => null,
                getString: (name: string) => (name === "sortby" ? "tickets" : name === "updates" ? "msg" : null),
                getInteger: (name: string) => (name === "tickets" ? 450 : null),
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds?.[0]?.title?.includes("Settings updated"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Enabled: **true**"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Show max: **true**"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Sort By: **tickets**"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Tickets: **450**"));
        assert.strictEqual(updatedUser.guildTickets.enabled, true);
        assert.strictEqual(updatedUser.guildTickets.showMax, true);
        assert.strictEqual(updatedUser.guildTickets.sortBy, "tickets");
        assert.strictEqual(updatedUser.guildTickets.tickets, 450);
    });

    test("run() should validate allycode format", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: () => null,
                getString: (name: string) => (name === "allycode" ? "invalid-code" : null),
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("COMMAND_ARENAWATCH_INVALID_AC"),
            "Should show invalid allycode error",
        );
    });

    test("run() should validate allycode exists via API", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            getAllyCode: async (interaction: any, allycode: string) => allycode,
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
            swgohAPI: {
                unitStats: async () => null,
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: () => null,
                getString: (name: string) => (name === "allycode" ? "123456789" : null),
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("could not find a match"),
            "Should show allycode not found error",
        );
    });

    test("run() should set valid allycode", async () => {
        const updatedUser: any = { guildTickets: null };
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            getAllyCode: async (interaction: any, allycode: string) => allycode,
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async (userId: string, user: any) => {
                    Object.assign(updatedUser, user);
                },
            },
            swgohAPI: {
                unitStats: async () => [
                    {
                        name: "TestPlayer",
                        allyCode: 123456789,
                    },
                ],
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: () => null,
                getString: (name: string) => (name === "allycode" ? "123456789" : null),
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds?.[0]?.title?.includes("Settings updated"));
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("123456789"));
        assert.strictEqual(updatedUser.guildTickets.allycode, 123456789);
    });

    test("run() should error when no options are provided to set command", async () => {
        const bot = createMockBot({
            getPatronUser: async () => ({ amount_cents: 100 }),
            userReg: {
                getUser: async () => ({
                    id: "test-user-123",
                    accounts: [],
                    guildTickets: null,
                }),
                updateUser: async () => {},
            },
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            user: { id: "test-user-123" },
            options: {
                getSubcommand: () => "set",
                getBoolean: () => null,
                getChannel: () => null,
                getString: () => null,
                getInteger: () => null,
            } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                return data;
            },
        });

        const cmd = new GuildTickets(bot as any);
        await cmd.run(bot as any, interaction, { level: 3 });

        assert.strictEqual(replyCalls.length, 1);
        assert.ok(
            replyCalls[0].embeds?.[0]?.description?.includes("No options provided"),
            "Should show no options provided error",
        );
    });
});
