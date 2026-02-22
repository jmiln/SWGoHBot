import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import Zetas from "../../slash/zetas.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("Zetas", () => {
    const originalPlayer = swgohAPI.player;
    const originalUnitNames = swgohAPI.unitNames;
    const originalLangChar = swgohAPI.langChar;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.unitNames = originalUnitNames;
        swgohAPI.langChar = originalLangChar;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.unitNames = originalUnitNames;
        swgohAPI.langChar = originalLangChar;
    });

    it("should initialize with correct name", () => {
        const command = new Zetas();
        assert.strictEqual(command.commandData.name, "zetas");
    });

    it("should have player and guild subcommands", () => {
        const command = new Zetas();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("player"), "Expected player subcommand");
        assert.ok(subcommandNames.includes("guild"), "Expected guild subcommand");
    });

    it("should return error when no allycode is registered and none provided", async () => {
        // Error returned before interaction.reply() when allycode is null
        const interaction = createMockInteraction({ optionsData: { _subcommand: "player" } });
        const ctx = createCommandContext({ interaction });
        const command = new Zetas();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find a match");
    });

    it("should return error for an invalid character filter", async () => {
        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [createMockUnit({ defId: "DARTHVADER", combatType: 1, skills: [] })],
            });

        const interaction = createMockInteraction({
            optionsData: {
                _subcommand: "player",
                allycode: "123456789",
                character: "NONEXISTENT_UNIT_ZZZ_999",
            },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Zetas();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should display player zetas list", async () => {
        const unitWithZeta = createMockUnit({
            defId: "DARTHVADER",
            nameKey: "Darth Vader",
            combatType: 1,
            skills: [
                {
                    id: "uniqueskill",
                    tier: 8,
                    tiers: 8,
                    zetaTier: 7,
                    omicronTier: 99,
                    isZeta: true,
                    isOmicron: false,
                    nameKey: "Lord of the Sith",
                } as any,
            ],
        });

        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [unitWithZeta],
            });
        swgohAPI.unitNames = async () => ({ DARTHVADER: "Darth Vader" });
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "player", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Zetas();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");
    });
});
