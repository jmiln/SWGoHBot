import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
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
        arenaPlayerRegistry.init(cache);
    });

    // Unique interaction user for this file — the shared mock default ("987654321") is
    // read by other test files that expect it to stay unregistered
    const REG_USER = { id: "register-test-user", username: "RegTester" } as any;

    // Scope cleanup to this file's ids/codes — concurrent test files share these collections
    const REG_TEST_USER_FILTER = { id: { $in: ["register-test-user", "other-user-id-999"] } };
    const REG_TEST_PLAYER_FILTER = { allyCode: { $in: [123456789, 987654321] } };

    after(async () => {
        try {
            const client = await getMongoClient();
            await client.db(testDbName).collection("users").deleteMany(REG_TEST_USER_FILTER);
            await client.db(testDbName).collection("arenaPlayers").deleteMany(REG_TEST_PLAYER_FILTER);
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
        // Clear this file's users and arenaPlayers docs before each test
        try {
            const client = await getMongoClient();
            await client.db(testDbName).collection("users").deleteMany(REG_TEST_USER_FILTER);
            await client.db(testDbName).collection("arenaPlayers").deleteMany(REG_TEST_PLAYER_FILTER);
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
            user: REG_USER,
            optionsData: { allycode: "invalid" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "NOT__ a valid ally code");
    });

    it("should return error for ally code that is too short", async () => {
        const interaction = createMockInteraction({
            user: REG_USER,
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
            user: REG_USER,
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
            user: REG_USER,
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
            embedData.author?.name?.includes("BASE_REGISTRATION_SUCCESS"),
            `Expected success header in embed, got: ${embedData.author?.name}`,
        );
    });

    it("should store ally code as a number, not a string", async () => {
        const player = createMockPlayer({
            allyCode: 123456789,
            name: "NumberPlayer",
            stats: [
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
                { nameKey: "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
            ],
        });
        mockSwapi.setPlayerData(player);

        const interaction = createMockInteraction({
            user: REG_USER,
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

        const user = await userReg.getUser(interaction.user.id);
        assert.ok(user, "Expected user to be registered");
        assert.strictEqual(typeof user.accounts[0], "number", "allyCode must be stored as a number");
        assert.strictEqual(user.accounts[0], 123456789);
    });

    it("should return error when API returns empty result for a valid ally code", async () => {
        // Do not set any player data — unitStats will return an empty array

        const interaction = createMockInteraction({
            user: REG_USER,
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
                return (d.description || "").includes("BASE_REGISTRATION_FAILURE");
            });
        });
        assert.ok(hasFailureMsg, "Expected BASE_REGISTRATION_FAILURE in one of the replies");
    });
});
