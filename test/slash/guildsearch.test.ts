import assert from "node:assert/strict";
import test from "node:test";
import GuildSearch from "../../slash/guildsearch.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("GuildSearch Command", () => {
    const createTestInteraction = (options: any) => {
        return createMockInteraction({
            user: { id: "test-user-id" } as any,
            guild: { id: "test-guild-id" } as any,
            editReply: async () => {},
            ...options,
        });
    };

    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new GuildSearch(bot);
        assert.equal(cmd.commandData.name, "guildsearch");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() handles character subcommand", async () => {
        const bot = createMockBot();
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ cooldown: 0, cacheMinutes: 120, player: "123456789", guild: null }) as any;

        const replyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "character",
                getString: (name: string) => {
                    if (name === "character") return "cls";
                    return null;
                },
                getInteger: () => null,
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new GuildSearch(bot);
        await cmd.run(bot, interaction);

        // Should have called reply at least once (with "please wait")
        assert.ok(replyCalls.length > 0);
    });

    test("run() handles ship subcommand", async () => {
        const bot = createMockBot({
            ships: [
                {
                    name: "Test Ship",
                    uniqueName: "TESTSHIP",
                    aliases: ["tship"],
                    avatarURL: "",
                    side: "light",
                    factions: [],
                    avatarName: "tship",
                },
            ],
        });
        bot.getAllyCode = async () => "123456789";
        bot.getPlayerCooldown = async () => ({ cooldown: 0, cacheMinutes: 120 });
        bot.swgohAPI = {
            guild: async () => ({ name: "Test Guild", roster: [], updated: Date.now() }),
        } as any;

        const replyCalls: any[] = [];
        const editReplyCalls: any[] = [];
        const interaction = createTestInteraction({
            options: {
                getSubcommand: () => "ship",
                getString: () => "tship",
                getInteger: () => null,
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
            editReply: async (data: any) => editReplyCalls.push(data),
        });

        const cmd = new GuildSearch(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0); // Should have replied with "please wait"
        assert.ok(editReplyCalls.length > 0); // Should have edited with result or error
    });
});
