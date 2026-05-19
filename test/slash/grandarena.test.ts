import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import swgohAPI from "../../modules/swapi.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import GrandArena from "../../slash/grandarena.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

const originalUnitStats = swgohAPI.unitStats;
const originalGetPlayerCooldown = patreonFuncs.getPlayerCooldown;

const mockCooldown = { player: 60000, guild: 3600000 };

function makeDarthVader(overrides: Record<string, any> = {}) {
    return createMockUnit({
        defId: "DARTHVADER",
        nameKey: "Darth Vader",
        combatType: 1,
        gear: 13,
        rarity: 7,
        gp: 28000,
        level: 85,
        relic: { currentTier: 9 },
        skills: [
            { id: "basic01darthvader", tier: 8, tiers: 8, isZeta: false, isOmicron: false },
            { id: "special01darthvader", tier: 8, tiers: 8, isZeta: true, isOmicron: false },
        ],
        ...overrides,
    });
}

describe("GrandArena Functionality", () => {
    beforeEach(() => {
        patreonFuncs.getPlayerCooldown = async () => mockCooldown as any;
    });

    afterEach(() => {
        swgohAPI.unitStats = originalUnitStats;
        patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
    });

    it("should return a comparison embed with all expected field sections", async () => {
        const player1 = createMockPlayer({
            name: "TestPlayer1",
            allyCode: 123456789,
            roster: [makeDarthVader()],
        });
        const player2 = createMockPlayer({
            name: "TestPlayer2",
            allyCode: 987654321,
            roster: [makeDarthVader({ gear: 12, gp: 20000, relic: null })],
        });

        swgohAPI.unitStats = async () => [player1, player2] as any;

        const interaction = createMockInteraction({
            optionsData: {
                allycode_1: "123456789",
                allycode_2: "987654321",
            },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        const lastReply = getLastReply(interaction);
        assert.ok(lastReply.embeds?.length > 0, "Expected embed in final reply");

        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.fields?.length > 0, "Expected embed fields");

        const fieldNames = embedData.fields.map((f: any) => f.name);
        assert.ok(fieldNames.includes("General Overview"), "Expected General Overview field");
        assert.ok(fieldNames.includes("GP Stats Overview"), "Expected GP Stats Overview field");
        assert.ok(fieldNames.includes("Character Gear Counts"), "Expected Character Gear Counts field");
        assert.ok(fieldNames.includes("Character Rarity Counts"), "Expected Character Rarity Counts field");
        assert.ok(fieldNames.includes("Character Relic Counts"), "Expected Character Relic Counts field");
        assert.ok(fieldNames.includes("Mod Stats Overview"), "Expected Mod Stats Overview field");
    });

    it("should set the embed author using the output header language key", async () => {
        const player1 = createMockPlayer({ name: "AlphaPlayer", allyCode: 123456789, roster: [makeDarthVader()] });
        const player2 = createMockPlayer({ name: "BetaPlayer", allyCode: 987654321, roster: [makeDarthVader()] });

        swgohAPI.unitStats = async () => [player1, player2] as any;

        const interaction = createMockInteraction({
            optionsData: { allycode_1: "123456789", allycode_2: "987654321" },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        const lastReply = getLastReply(interaction);
        const embed = lastReply.embeds?.[0];
        const embedData = embed?.data || embed;

        // The test language mock returns the language key itself; verify the correct key is used
        assert.ok(embedData?.author?.name?.includes("COMMAND_GRANDARENA_OUT_HEADER"), "Expected embed author to use grandarena output header language key");

        // Verify the General Overview field contains GP values derived from the mock roster
        const overviewField = embedData?.fields?.find((f: any) => f.name === "General Overview");
        assert.ok(overviewField?.value?.length > 0, "Expected General Overview field to have content");
    });

    it("should include a character comparison section when characters filter is used", async () => {
        const player1 = createMockPlayer({ name: "P1", allyCode: 123456789, roster: [makeDarthVader()] });
        const player2 = createMockPlayer({ name: "P2", allyCode: 987654321, roster: [makeDarthVader({ gear: 12, relic: null })] });

        swgohAPI.unitStats = async () => [player1, player2] as any;

        const interaction = createMockInteraction({
            optionsData: {
                allycode_1: "123456789",
                allycode_2: "987654321",
                characters: "Darth Vader",
            },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        const lastReply = getLastReply(interaction);
        const embed = lastReply.embeds?.[0];
        const embedData = embed?.data || embed;
        assert.ok(embedData?.fields?.length > 0, "Expected fields in character comparison embed");

        const fieldNames = embedData.fields.map((f: any) => f.name);
        const hasDarthVaderField = fieldNames.some((n: string) => n.includes("Darth Vader") || n.includes("DARTHVADER"));
        assert.ok(hasDarthVaderField, "Expected a field comparing Darth Vader between the two players");
    });

    it("should return an error reply when the API call fails", async () => {
        swgohAPI.unitStats = async () => {
            throw new Error("API unavailable");
        };

        const interaction = createMockInteraction({
            optionsData: { allycode_1: "123456789", allycode_2: "987654321" },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        assertErrorReply(interaction, "Could not get user");
    });

    it("should return an error reply when players have empty rosters", async () => {
        const player1 = createMockPlayer({ name: "EmptyP1", allyCode: 123456789, roster: [] });
        const player2 = createMockPlayer({ name: "EmptyP2", allyCode: 987654321, roster: [] });

        swgohAPI.unitStats = async () => [player1, player2] as any;

        const interaction = createMockInteraction({
            optionsData: { allycode_1: "123456789", allycode_2: "987654321" },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        assertErrorReply(interaction, "Could not get user");
    });

    it("should return an error reply when a faction filter matches nothing", async () => {
        const player1 = createMockPlayer({ name: "P1", allyCode: 123456789, roster: [makeDarthVader()] });
        const player2 = createMockPlayer({ name: "P2", allyCode: 987654321, roster: [makeDarthVader()] });

        swgohAPI.unitStats = async () => [player1, player2] as any;

        const interaction = createMockInteraction({
            optionsData: {
                allycode_1: "123456789",
                allycode_2: "987654321",
                faction: "NONEXISTENTFACTION99999",
            },
        } as any);

        await new GrandArena().run(createCommandContext({ interaction }));

        assertErrorReply(interaction);
    });
});
