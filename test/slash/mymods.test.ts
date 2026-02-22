import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyMods from "../../slash/mymods.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyMods", () => {
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
        const command = new MyMods();
        assert.strictEqual(command.commandData.name, "mymods");
    });

    it("should have character, best, and missing subcommands", () => {
        const command = new MyMods();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("character"), "Expected character subcommand");
        assert.ok(subcommandNames.includes("best"), "Expected best subcommand");
        assert.ok(subcommandNames.includes("missing"), "Expected missing subcommand");
    });

    it("should return error when no allycode is registered and none provided", async () => {
        // Error returned before interaction.reply() when getAllyCode returns null
        const interaction = createMockInteraction({ optionsData: { _subcommand: "character", character: "Darth Vader" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyMods();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find a match");
    });

    it("should reply with content when character is not found in search", async () => {
        // Player fetched, then findChar returns nothing → editReply with content (not an error embed)
        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [createMockUnit({ defId: "DARTHVADER", combatType: 1 })],
            });

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "NONEXISTENT_UNIT_ZZZ_999", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyMods();
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const lastReply = replies[replies.length - 1];
        // editReply with content (not ephemeral embed) when character lookup fails after player fetch
        assert.ok(lastReply.content?.includes("BASE_SWGOH_NO_CHAR_FOUND"), "Expected no-char-found message in content");
    });

    it("should display mods for a character the player owns", async () => {
        const vaderWithMods = createMockUnit({
            defId: "VADER",
            nameKey: "Darth Vader",
            combatType: 1,
            mods: [
                {
                    id: "mod1",
                    level: 15,
                    tier: 5,
                    slot: 1,
                    set: 2,
                    pips: 6,
                    primaryStat: { unitStat: 5, value: 30 },
                    secondaryStat: [
                        { unitStat: 5, value: 20, roll: 5 },
                        { unitStat: 41, value: 120, roll: 3 },
                    ],
                } as any,
            ],
        });

        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [vaderWithMods],
            });
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyMods();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");
    });
});
