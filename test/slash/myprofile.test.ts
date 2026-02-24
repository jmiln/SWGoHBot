import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyProfile from "../../slash/myprofile.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyProfile", () => {
    const originalPlayer = swgohAPI.player;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
    });

    it("should initialize with correct name", () => {
        const command = new MyProfile();
        assert.strictEqual(command.commandData.name, "myprofile");
    });

    it("should return error when no allyCode is registered and none provided", async () => {
        const interaction = createMockInteraction({ optionsData: {} });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "not a valid ally code");
    });

    it("should return error when player data cannot be fetched", async () => {
        swgohAPI.player = async () => null;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "Please make sure you are registered");
    });

    it("should display player profile with stats and GP", async () => {
        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            guildName: "Test Guild",
            level: 85,
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [] },
                ship: { rank: 17, squad: [] },
            },
            stats: [
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
                { nameKey: "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
            ],
            roster: [
                createMockUnit({ defId: "DARTHVADER", combatType: 1, rarity: 7, skills: [], mods: [] }),
                createMockUnit({ defId: "CAPITALCHIMAERA", combatType: 2, rarity: 7, skills: [], mods: [] }),
            ],
        });
        swgohAPI.player = async () => mockPlayer;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.author?.name, "Expected author in embed");
        assert.ok(embedData.fields?.length > 0, "Expected fields in embed");
    });

    it("should return error when player has no stats", async () => {
        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            stats: [],
            roster: [],
        });
        swgohAPI.player = async () => mockPlayer;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find that player");
    });
});
