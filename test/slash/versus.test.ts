import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import Versus from "../../slash/versus.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("Versus", () => {
    const originalPlayer = swgohAPI.player;
    const originalUnitNames = swgohAPI.unitNames;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.unitNames = originalUnitNames;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.unitNames = originalUnitNames;
    });

    it("should initialize with correct name", () => {
        const command = new Versus();
        assert.strictEqual(command.commandData.name, "versus");
    });

    it("should return error when both ally codes are invalid", async () => {
        // getAllyCode uses useInteractionId=false so null inputs return null without hitting MongoDB
        const interaction = createMockInteraction({ optionsData: {} });
        const ctx = createCommandContext({ interaction });
        const command = new Versus();
        await command.run(ctx);
        assertErrorReply(interaction, "Both ally codes were invalid");
    });

    it("should return error when allycode_1 is missing but allycode_2 is provided", async () => {
        const interaction = createMockInteraction({ optionsData: { allycode_2: "222222222" } });
        const ctx = createCommandContext({ interaction });
        const command = new Versus();
        await command.run(ctx);
        assertErrorReply(interaction, "Ally code #1 was invalid");
    });

    it("should return error when character is not found", async () => {
        // Both allycodes are literal 9-digit strings so getAllyCode returns them directly (no MongoDB needed)
        // Character check happens before fetchPlayerWithCooldown
        const interaction = createMockInteraction({
            optionsData: {
                allycode_1: "111111111",
                allycode_2: "222222222",
                character: "NONEXISTENT_UNIT_ZZZ_999",
            },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Versus();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_GRANDARENA_INVALID_CHAR");
    });

    it("should display a stat comparison when both players have the character", async () => {
        const vaderUnit = createMockUnit({
            defId: "VADER",
            nameKey: "Darth Vader",
            combatType: 1,
            level: 85,
            rarity: 7,
            gear: 13,
            skills: [],
            relic: { currentTier: 9 },
            stats: {
                final: { Speed: 180, Health: 40000, Protection: 20000 } as any,
                mods: {} as any,
                gp: 25000,
            },
        });

        const player1 = createMockPlayer({ allyCode: 111111111, name: "Player One", updated: Date.now(), roster: [vaderUnit] });
        const player2 = createMockPlayer({
            allyCode: 222222222,
            name: "Player Two",
            updated: Date.now(),
            roster: [{ ...vaderUnit, stats: { final: { Speed: 200 } as any, mods: {} as any, gp: 26000 } }],
        });

        swgohAPI.player = async (allycode) => {
            if (String(allycode) === "111111111") return player1;
            if (String(allycode) === "222222222") return player2;
            return null;
        };
        swgohAPI.unitNames = async () => ({ VADER: "Darth Vader" });

        const interaction = createMockInteraction({
            optionsData: { allycode_1: "111111111", allycode_2: "222222222", character: "Darth Vader" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Versus();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.title?.includes("Player One"), "Expected player 1 name in title");
        assert.ok(embedData.title?.includes("Player Two"), "Expected player 2 name in title");
    });
});
