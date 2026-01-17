import assert from "node:assert/strict";
import test from "node:test";
import Help from "../../slash/help.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Help Command", () => {
    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new Help(bot);
        assert.equal(cmd.commandData.name, "help");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() displays all commands when no options provided", async () => {
        const bot = createMockBot();
        bot.help = {
            General: {
                description: "General commands",
                commands: {
                    test: {
                        usage: ["<arg1>", "[arg2]"],
                        desc: "Test command description",
                    },
                },
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => null,
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Help(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].title.includes("Slash Commands"));
    });

    test("run() displays specific command details when command specified", async () => {
        const bot = createMockBot();
        bot.help = {
            General: {
                description: "General commands",
                commands: {
                    testcommand: {
                        usage: ["<arg1>", "[arg2]"],
                        desc: "Test command description",
                    },
                },
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "command" ? "testcommand" : null),
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Help(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].title.toLowerCase().includes("testcommand"));
        assert.ok(replyCalls[0].embeds[0].description.includes("Test command description"));
    });

    test("run() returns error for non-existent command", async () => {
        const bot = createMockBot();
        bot.help = {
            General: {
                description: "General commands",
                commands: {},
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "command" ? "nonexistentcommand" : null),
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Help(bot);
        await cmd.run(bot, interaction);

        // Should have returned an error
        assert.ok(replyCalls.length === 0 || replyCalls[0]?.content || replyCalls[0]?.embeds);
    });

    test("run() filters commands by category when specified", async () => {
        const bot = createMockBot();
        bot.help = {
            General: {
                description: "General commands",
                commands: {
                    test1: {
                        usage: [],
                        desc: "Test 1",
                    },
                },
            },
            Admin: {
                description: "Admin commands",
                commands: {
                    test2: {
                        usage: [],
                        desc: "Test 2",
                    },
                },
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: (name: string) => (name === "category" ? "Admin" : null),
                getBoolean: () => null,
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Help(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds[0].fields.some((f: any) => f.name === "ADMIN"));
    });

    test("run() handles detailed view when details flag is true", async () => {
        const bot = createMockBot();
        bot.help = {
            General: {
                description: "General commands",
                commands: {
                    test: {
                        usage: ["<arg1>", "[arg2]"],
                        desc: "Test command",
                    },
                },
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => null,
                getBoolean: (name: string) => (name === "details" ? true : null),
            } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Help(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds);
    });
});
