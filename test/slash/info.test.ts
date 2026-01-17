import assert from "node:assert/strict";
import test from "node:test";
import Info from "../../slash/info.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

const MOCK_PLAYER_COUNT = 1000;
const MOCK_GUILD_COUNT = 150;
const MOCK_SHARD_COUNT = 2;
const MOCK_CACHED_GUILDS = 50;
const MOCK_CACHED_USERS = 1000;

function createMockDatabase(playerCount = MOCK_PLAYER_COUNT, guildCount = MOCK_GUILD_COUNT) {
    return {
        db: async () => ({
            collection: (name: string) => ({
                estimatedDocumentCount: async () => (name === "playerStats" ? playerCount : guildCount),
            }),
        }),
    } as any;
}

function createMockClient(shardCount = MOCK_SHARD_COUNT, guildSize = MOCK_CACHED_GUILDS, userSize = MOCK_CACHED_USERS) {
    return {
        shard: {
            count: shardCount,
            fetchClientValues: async () => [guildSize, guildSize - 5],
        },
        guilds: {
            cache: {
                size: guildSize,
            },
        },
        users: {
            cache: {
                size: userSize,
            },
        },
    } as any;
}

function createMockLanguage() {
    return {
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
                    links: { Support: "https://support.example.com" },
                    shardHeader: "Shard Info",
                    header: "Bot Info",
                };
            }
            return key;
        },
    } as any;
}

test.describe("Info Command", () => {
    test("command is instantiated with correct properties", () => {
        const bot = createMockBot();
        const cmd = new Info(bot);

        assert.equal(cmd.commandData.name, "info");
        assert.equal(cmd.commandData.guildOnly, false);
        assert.equal(cmd.commandData.description, "Displays general stats & info about the bot");
    });

    test("run() displays bot info with all required fields", async () => {
        const replyCalls: any[] = [];
        const bot = createMockBot({
            shardId: 0,
            mongo: createMockDatabase(),
            config: {
                mongodb: {
                    swapidb: "swapidb",
                },
            },
        });

        const interaction = createMockInteraction({
            client: createMockClient(),
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            language: createMockLanguage(),
        });

        const cmd = new Info(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1, "Should reply exactly once");

        const reply = replyCalls[0];
        assert.ok(reply.embeds, "Reply should contain embeds");
        assert.equal(reply.embeds.length, 1, "Should contain one embed");

        const embed = reply.embeds[0];
        assert.ok(embed.author, "Embed should have author");
        assert.equal(embed.author.name, "Shard Info", "Should show shard header when shards exist");
        assert.ok(embed.description, "Embed should have description");
        assert.ok(embed.description.includes("Stats"), "Description should include stats header");
        assert.ok(embed.description.includes("SWGOH"), "Description should include SWGOH header");
        assert.ok(embed.fields, "Embed should have fields");
        assert.equal(embed.fields.length, 1, "Should have one field for links");
        assert.equal(embed.fields[0].name, "Support", "Should include support link");
        assert.ok(typeof embed.color === "number", "Should have a color");
    });

    test("run() shows correct header when no shards exist", async () => {
        const replyCalls: any[] = [];
        const bot = createMockBot({
            shardId: 0,
            mongo: createMockDatabase(),
            config: {
                mongodb: {
                    swapidb: "swapidb",
                },
            },
        });

        const interaction = createMockInteraction({
            client: createMockClient(0),
            reply: async (data: any) => {
                replyCalls.push(data);
            },
            language: createMockLanguage(),
        });

        interaction.client.shard = null;

        const cmd = new Info(bot);
        await cmd.run(bot, interaction);

        const embed = replyCalls[0].embeds[0];
        assert.equal(embed.author.name, "Bot Info", "Should show bot info header when no shards");
    });

    test("run() handles database errors gracefully", async () => {
        const replyCalls: any[] = [];
        const bot = createMockBot({
            shardId: 0,
            mongo: {
                db: async () => {
                    throw new Error("Database connection failed");
                },
            } as any,
            config: {
                mongodb: {
                    swapidb: "swapidb",
                },
            },
        });

        const interaction = createMockInteraction({
            reply: async (data: any) => {
                replyCalls.push(data);
            },
        });

        const cmd = new Info(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1, "Should reply with error message");
        const reply = replyCalls[0];
        assert.ok(reply.embeds, "Error reply should contain embeds");
        const embed = reply.embeds[0];
        assert.ok(embed.description?.includes("error"), "Should show error message");
    });
});
