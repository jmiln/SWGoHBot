import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import Need from "../../slash/need.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("Need", () => {
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
        const command = new Need();
        assert.strictEqual(command.commandData.name, "need");
    });

    it("should return error when no filter is specified", async () => {
        // Literal allycode bypasses MongoDB, no filter options → error before interaction.reply()
        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);
        assertErrorReply(interaction, "You need to specify a location or faction.");
    });

    it("should return error when no allycode is registered and none provided", async () => {
        const interaction = createMockInteraction({ optionsData: { battle: "Cantina" } });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find a valid ally code");
    });

    it("should display a need list for a battle filter", async () => {
        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updated: Date.now(),
                roster: [createMockUnit({ defId: "DARTHVADER", combatType: 1, rarity: 6, nameKey: "Darth Vader" })],
            });
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({
            optionsData: { allycode: "123456789", battle: "Cantina" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");
    });
});
