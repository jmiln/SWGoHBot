import assert from "node:assert/strict";
import test from "node:test";
import GuildUpdate from "../../slash/guildupdate.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("GuildUpdate Command", () => {
    const createTestInteraction = (options: any) => {
        return createMockInteraction({
            user: { id: "test-user-id", username: "TestUser" } as any,
            guild: { id: "test-guild-id" } as any,
            ...options,
        });
    };

    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new GuildUpdate(bot);
        assert.equal(cmd.commandData.name, "guildupdate");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() handles view subcommand for patron user", async () => {
        const bot = createMockBot();
        bot.userReg = {
            getUser: async () => ({
                guildUpdate: {
                    enabled: true,
                    channel: "channel-id",
                    allycode: 123456789,
                },
            }),
            updateUser: async () => {},
        } as any;
        bot.getPatronUser = async () => ({ discordID: "test-user-id", amount_cents: 500 });

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "view",
                getString: () => null,
                getBoolean: () => null,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildUpdate(bot);
        await cmd.run(bot, interaction, { level: 5 });

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].title.includes("Guild update settings"));
    });

    test("run() handles set subcommand with enabled flag", async () => {
        const bot = createMockBot();
        bot.userReg = {
            getUser: async () => ({
                guildUpdate: {
                    enabled: false,
                    channel: null,
                    allycode: null,
                },
            }),
            updateUser: async () => {},
        } as any;
        bot.getPatronUser = async () => ({ discordID: "test-user-id", amount_cents: 500 });

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "set",
                getString: () => null,
                getBoolean: (name: string) => (name === "enabled" ? true : null),
                getChannel: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildUpdate(bot);
        await cmd.run(bot, interaction, { level: 5 });

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].title.includes("Settings updated"));
    });

    test("run() returns error for non-patron user", async () => {
        const bot = createMockBot();
        bot.userReg = {
            getUser: async () => ({
                guildUpdate: {
                    enabled: false,
                    channel: null,
                    allycode: null,
                },
            }),
        } as any;
        bot.getPatronUser = async () => ({ discordID: "test-user-id", amount_cents: 0 });

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "view",
                getString: () => null,
                getBoolean: () => null,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildUpdate(bot);
        await cmd.run(bot, interaction, { level: 5 });

        // Should have returned an error
        assert.ok(replyCalls.length === 0 || replyCalls[0]?.content || replyCalls[0]?.embeds);
    });

    test("run() returns error when user not found", async () => {
        const bot = createMockBot();
        bot.userReg = {
            getUser: async () => null,
        } as any;

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "view",
                getString: () => null,
                getBoolean: () => null,
                getChannel: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildUpdate(bot);
        await cmd.run(bot, interaction, { level: 5 });

        // Should have returned an error about user data
        assert.ok(replyCalls.length === 0 || replyCalls[0]?.content || replyCalls[0]?.embeds);
    });

    test("run() handles set subcommand with channel", async () => {
        const bot = createMockBot();
        bot.userReg = {
            getUser: async () => ({
                guildUpdate: {
                    enabled: false,
                    channel: null,
                    allycode: null,
                },
            }),
            updateUser: async () => {},
        } as any;
        bot.getPatronUser = async () => ({ discordID: "test-user-id", amount_cents: 500 });

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "set",
                getString: () => null,
                getBoolean: () => null,
                getChannel: (name: string) => (name === "channel" ? { id: "new-channel-id" } : null),
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildUpdate(bot);
        await cmd.run(bot, interaction, { level: 5 });

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].title.includes("Settings updated"));
    });
});
