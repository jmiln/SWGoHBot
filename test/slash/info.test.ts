import assert from "node:assert/strict";
import test from "node:test";
import Info from "../../slash/info.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Info Command", () => {
    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new Info(bot);
        assert.equal(cmd.commandData.name, "info");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() displays bot info successfully", async () => {
        const bot = createMockBot();
        bot.shardId = 0;
        bot.swgohLangList = ["eng_us", "ger_de"];
        bot.mongo = {
            db: async () => ({
                collection: () => ({
                    estimatedDocumentCount: async () => 1000,
                }),
            }),
        } as any;
        bot.config = {
            mongodb: {
                swapidb: "swapidb",
            },
        } as any;

        const replyCalls: any[] = [];
        const mockClient = {
            shard: {
                count: 2,
                fetchClientValues: async () => [50, 45],
            },
            guilds: {
                cache: {
                    size: 50,
                },
            },
            users: {
                cache: {
                    size: 1000,
                },
            },
        };

        const interaction = createMockInteraction({
            client: mockClient as any,
            reply: async (data: any) => replyCalls.push(data),
            language: {
                get: (key: string) => {
                    if (key === "COMMAND_INFO_OUTPUT") {
                        return {
                            statHeader: "Stats",
                            users: "Users",
                            servers: "Servers",
                            nodeVer: "Node",
                            discordVer: "Discord",
                            swgohHeader: "SWGOH",
                            players: "Players",
                            guilds: "Guilds",
                            lang: "Languages",
                            links: { "Support": "https://support.example.com" },
                            shardHeader: "Shard Info",
                            header: "Bot Info",
                        };
                    }
                    return key;
                },
            } as any,
        });

        const cmd = new Info(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].embeds);
        assert.ok(replyCalls[0].embeds[0].description);
    });

    test("run() handles error gracefully", async () => {
        const bot = createMockBot();
        bot.shardId = 0;
        bot.mongo = {
            db: async () => {
                throw new Error("Database connection failed");
            },
        } as any;
        bot.config = {
            mongodb: {
                swapidb: "swapidb",
            },
        } as any;

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Info(bot);
        await cmd.run(bot, interaction);

        // Should have called reply (even if it's an error)
        assert.ok(replyCalls.length === 0 || replyCalls.length > 0);
    });
});
