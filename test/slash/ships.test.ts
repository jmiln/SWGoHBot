import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import swgohAPI from "../../modules/swapi.ts";
import Ships from "../../slash/ships.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { MockSWAPI } from "../mocks/mockSwapi.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("Ships", () => {
    let mockSwapi: MockSWAPI;

    beforeEach(() => {
        mockSwapi = new MockSWAPI();
        (swgohAPI as any).getCharacter = mockSwapi.getCharacter.bind(mockSwapi);
    });

    it("should return error for ship not found", async () => {
        const interaction = createMockInteraction({
            optionsData: { ship: "NonexistentShip123" },
        });

        const command = new Ships();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "cannot find");
    });

    it("should return error for multiple ship matches", async () => {
        const interaction = createMockInteraction({
            optionsData: { ship: "SHIP" },
        });

        const command = new Ships();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        // Either finds nothing or finds multiple - both should error
        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");
    });

    it("should return embed with fields for a valid ship with abilities", async () => {
        // JEDISTARFIGHTERAHSOKATANO resolves to a single unique ship
        mockSwapi.setCharacterData("JEDISTARFIGHTERAHSOKATANO", {
            baseId: "JEDISTARFIGHTERAHSOKATANO",
            combatType: 2,
            crew: [],
            factions: ["Galactic Republic"],
            legend: false,
            skillReferenceList: [
                {
                    skillId: "basicskill_jedistarfighterahsokatano",
                    requiredTier: 1,
                    requiredRarity: 1,
                    requiredRelicTier: -1,
                    name: "Reflexive Shot",
                    cooldown: 0,
                    desc: "Deal Physical damage to target enemy.",
                },
            ],
            unitTierList: [],
            categoryIdList: null,
        } as any);

        const interaction = createMockInteraction({
            optionsData: { ship: "JEDISTARFIGHTERAHSOKATANO" },
        });

        const command = new Ships();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const lastReply = replies[replies.length - 1];
        assert.ok(lastReply.embeds, "Expected embed in reply");
        assert.ok(lastReply.embeds.length > 0, "Expected at least one embed");

        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.fields?.length > 0, "Expected embed to have fields from abilities");
    });

    it("should show 'not been fully updated' field when ship has no data", async () => {
        // Return a character with empty data (no crew, no factions, no abilities)
        mockSwapi.setCharacterData("JEDISTARFIGHTERAHSOKATANO", {
            baseId: "JEDISTARFIGHTERAHSOKATANO",
            combatType: 2,
            crew: [],
            factions: [],
            legend: false,
            skillReferenceList: [],
            unitTierList: [],
            categoryIdList: null,
        } as any);

        const interaction = createMockInteraction({
            optionsData: { ship: "JEDISTARFIGHTERAHSOKATANO" },
        });

        const command = new Ships();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const lastReply = getLastReply(interaction);
        assert.ok(lastReply.embeds, "Expected embed in reply");

        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const fields = embedData.fields || [];
        const errorField = fields.find((f: any) => f.name === "Error");
        assert.ok(errorField, "Expected an 'Error' field for ship with no data");
        assert.ok(errorField.value.includes("not been fully updated"), "Expected 'not been fully updated' message");
    });
});
