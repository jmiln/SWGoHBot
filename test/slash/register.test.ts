import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import Register from "../../slash/register.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { createMockPlayer, MockSWAPI } from "../mocks/mockSwapi.ts";
import { assertErrorReply } from "./helpers.ts";

const testDbName = env.MONGODB_SWGOHBOT_DB;

describe("Register", () => {
    let mockSwapi: MockSWAPI;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany({});
        } catch (_) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(async () => {
        mockSwapi = new MockSWAPI();
        // Replace unitStats on the real singleton with the mock version
        (swgohAPI as any).unitStats = mockSwapi.unitStats.bind(mockSwapi);
        // Mock getPlayerCooldown to avoid needing a fully initialized patreonFuncs
        (patreonFuncs as any).getPlayerCooldown = async () => ({ player: 180, guild: 360 });
        // Clear users collection before each test
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany({});
        } catch (_) {
            // Ignore
        }
    });

    it("should initialize with correct name", () => {
        const command = new Register();
        assert.strictEqual(command.commandData.name, "register");
    });

    it("should return error for invalid ally code format", async () => {
        const interaction = createMockInteraction({
            optionsData: { allycode: "invalid" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "NOT__ a valid ally code");
    });

    it("should return error for ally code that is too short", async () => {
        const interaction = createMockInteraction({
            optionsData: { allycode: "12345" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "NOT__ a valid ally code");
    });

    it("should return error when changing another user without admin permissions", async () => {
        // Valid allycode format, but user is different and permLevel < GUILD_ADMIN (6)
        const otherUser = { id: "other-user-id-999", username: "OtherUser" } as any;
        const interaction = createMockInteraction({
            optionsData: {
                allycode: "123456789",
                user: otherUser,
            },
        });
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_SHARDTIMES_MISSING_ROLE");
    });

    it("should register successfully when the API returns valid player data", async () => {
        const player = createMockPlayer({
            allyCode: 123456789,
            name: "GoodPlayer",
            stats: [
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
                { nameKey: "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
            ],
        });
        mockSwapi.setPlayerData(player);

        const interaction = createMockInteraction({
            guild: {
                id: "987654321",
                name: "Test Guild",
                members: { cache: { has: () => true } },
            } as any,
            optionsData: { allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // The command sends an initial "please wait" reply then edits to success.
        // The final reply should be a success embed (not ephemeral error).
        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds?.length > 0, "Expected a success embed");

        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        // Author name should be the success header key (mock language returns key as-is)
        assert.ok(
            embedData.author?.name?.includes("COMMAND_REGISTER_SUCCESS_HEADER"),
            `Expected success header in embed, got: ${embedData.author?.name}`,
        );
    });

    it("should return error when API returns empty result for a valid ally code", async () => {
        // Do not set any player data — unitStats will return an empty array

        const interaction = createMockInteraction({
            guild: {
                id: "987654321",
                name: "Test Guild",
                members: { cache: { has: () => true } },
            } as any,
            optionsData: { allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);

        // Find any reply that contains the failure message
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
        const hasFailureMsg = replies.some((r: any) => {
            const embeds = r.embeds || [];
            return embeds.some((e: any) => {
                const d = e.data || e;
                return (d.description || "").includes("COMMAND_REGISTER_FAILURE");
            });
        });
        assert.ok(hasFailureMsg, "Expected COMMAND_REGISTER_FAILURE in one of the replies");
    });
});
