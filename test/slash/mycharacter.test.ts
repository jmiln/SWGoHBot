import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyCharacter from "../../slash/mycharacter.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit, createRealLanguage } from "../mocks/index.ts";
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

    it("should have character and ship subcommands", () => {
        const command = new MyCharacter();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("character"), "Expected character subcommand");
        assert.ok(subcommandNames.includes("ship"), "Expected ship subcommand");
    });

    it("should return error for character search with no ally code registered", async () => {
        // No allycode provided and user not registered → getAllyCode returns null → error before reply
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_INVALID_ALLY_CODE");
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
        // Real language so BASE_STAT_NAMES resolves to a real object and the stat rows render
        // their computed values. With the key-echoing mock the stat name lookups miss and the
        // values never appear, so the assertions below would be invisible.
        const ctx = createCommandContext({ interaction, language: createRealLanguage() });
        const command = new MyCharacter();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embedData = reply.embeds[0].data || reply.embeds[0];

        // Author is "<player>'s <unit>"; description carries level/rarity/gp and the gear line.
        assert.ok(embedData.author?.name?.includes("TestPlayer"), "Expected the player name in the author");
        assert.ok(embedData.author?.name?.includes("Darth Vader"), "Expected the character name in the author");
        assert.match(embedData.description, /lvl 85 \| 7\* \| 25000 gp/, "Expected the rendered level/rarity/gp line");
        assert.match(embedData.description, /Gear: 13/, "Expected the rendered gear line");

        const fieldValue = (match: string): string =>
            embedData.fields?.find((f: { name: string; value: string }) => f.name.includes(match))?.value ?? "";

        // Abilities field lists the maxed basic ability.
        assert.ok(fieldValue("Abilities").includes("Basic"), "Expected the ability name in the Abilities field");

        // Stats field: computed final stats formatted with locale commas (Health 50000 -> 50,000).
        // Note: expandSpaces pads the stat labels with zero-width spaces, so assert the label and
        // its ":: value" separately rather than with a \s* bridge.
        const stats = fieldValue("Stats");
        assert.ok(stats.includes("Speed"), "Expected the Speed stat label");
        assert.ok(stats.includes(":: 180"), "Expected the rendered Speed value");
        assert.ok(stats.includes("Health"), "Expected the Health stat label");
        assert.ok(stats.includes(":: 50,000"), "Expected the rendered Health value with a locale comma");
        assert.ok(stats.includes("Protection"), "Expected the Protection stat label");
        assert.ok(stats.includes(":: 20,000"), "Expected the rendered Protection value");
    });
});
