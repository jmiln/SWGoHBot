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

    it("should return error when no filter is specified", async () => {
        // Literal allycode bypasses MongoDB, no filter options → error before interaction.reply()
        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_NEED_NO_LOCATION");
    });

    // The two capped faction_group_N options were replaced by one autocompleted `faction`, so the
    // no-filter guard has to recognise it.
    it("accepts the faction option as a filter", async () => {
        const interaction = createMockInteraction({ optionsData: { allycode: "123456789", faction: "species_wookiee" } });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const descriptions = replies.map((r: any) => {
            const embed = r.embeds?.[0];
            return (embed?.data ?? embed)?.description ?? r.content ?? "";
        });
        assert.ok(
            !descriptions.some((d: string) => d.includes("COMMAND_NEED_NO_LOCATION")),
            `faction must count as a filter, not fall through to the no-location error. Got: ${descriptions.join(" | ")}`,
        );
    });

    it("should return error when no allycode is registered and none provided", async () => {
        const interaction = createMockInteraction({ optionsData: { battle: "Cantina" } });
        const ctx = createCommandContext({ interaction });
        const command = new Need();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_INVALID_ALLY_CODE");
    });

    it("should display a partial-progress need list for a battle filter", async () => {
        // Player owns only Vader (6*); every other Cantina unit is un-owned (defaults to rarity 0),
        // so this is deterministically a PARTIAL result with strikethrough lines for the 0* units.
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

        const embed = reply.embeds[0];
        // Not everyone is 7*, so the description is the partial-progress branch (not COMMAND_NEED_COMPLETE).
        assert.strictEqual(embed.description, "COMMAND_NEED_PARTIAL");

        // The character section exists and formats un-owned units as struck-through 0* lines.
        const charField = embed.fields?.find((f: { name: string }) => f.name.includes("COMMAND_NEED_CHAR_HEADER"));
        assert.ok(charField, "Expected a character field");
        assert.ok(charField.value.includes("`0*`"), "Expected 0* lines for un-owned units");
        assert.ok(charField.value.includes("~~"), "Expected un-owned units to be struck through");
    });
});
