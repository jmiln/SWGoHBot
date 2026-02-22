import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyCharacter from "../../slash/mycharacter.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyCharacter", () => {
    const originalPlayer = swgohAPI.player;
    const originalLangChar = swgohAPI.langChar;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
    });

    it("should initialize with correct name", () => {
        const command = new MyCharacter();
        assert.strictEqual(command.commandData.name, "mycharacter");
    });

    it("should have character and ship subcommands", () => {
        const command = new MyCharacter();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("character"), "Expected character subcommand");
        assert.ok(subcommandNames.includes("ship"), "Expected ship subcommand");
    });

    it("should return error for character search with no allycode registered", async () => {
        // No allycode provided and user not registered → getAllyCode returns null → error before reply
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find a valid allycode");
    });

    it("should return error when character search yields no matches", async () => {
        // Literal allycode bypasses MongoDB. Invalid character name fails findChar before reply
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "NONEXISTENT_UNIT_ZZZ_999", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should return error when player does not have the character unlocked", async () => {
        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [], // Empty roster → character is locked
            });

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SWGOH_LOCKED_CHAR");
    });

    it("should display character stats when player has the unit", async () => {
        const vaderUnit = createMockUnit({
            defId: "VADER",
            nameKey: "Darth Vader",
            combatType: 1,
            level: 85,
            rarity: 7,
            gear: 13,
            gp: 25000,
            skills: [{ id: "basicskill", tier: 8, tiers: 8, isZeta: false, isOmicron: false, nameKey: "Basic" } as any],
            equipped: [],
            stats: {
                final: {
                    Speed: 180,
                    Health: 50000,
                    Protection: 20000,
                    Strength: 100,
                    Agility: 100,
                    Intelligence: 100,
                } as any,
                mods: {} as any,
                gp: 25000,
            },
        });

        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [vaderUnit],
            });
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");
    });
});
