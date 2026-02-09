import assert from "node:assert";
import { describe, it } from "node:test";
import Acronyms from "../../slash/acronyms.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertEmbedField, assertErrorReply, getLastReply } from "./helpers.ts";

describe("Acronyms", () => {
    it("should return definition for a single valid acronym", async () => {        const interaction = createMockInteraction({
            optionsData: { acronym: "CLS" }
        });

        const command = new Acronyms();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds, "Expected embed reply");

        const embed = reply.embeds[0];
        assert.ok(embed.description?.includes("CLS"), "Expected description to include acronym");

        // Check that the Results field exists and contains the definition
        assertEmbedField(interaction, "Results", "Commander Luke Skywalker");
    });

    it("should return definitions for multiple acronyms", async () => {        const interaction = createMockInteraction({
            optionsData: { acronym: "CLS JKR TB" }
        });

        const command = new Acronyms();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds, "Expected embed reply");

        const embed = reply.embeds[0];
        const resultsField = embed.fields.find((f: any) => f.name === "Results");
        assert.ok(resultsField, "Expected Results field");

        // All three acronyms should be in the results
        assert.ok(resultsField.value.includes("Commander Luke Skywalker"), "Expected CLS definition");
        assert.ok(resultsField.value.includes("Jedi Knight Revan"), "Expected JKR definition");
        assert.ok(resultsField.value.includes("Territory Battle"), "Expected TB definition");
    });

    it("should return error for unknown acronym", async () => {        const interaction = createMockInteraction({
            optionsData: { acronym: "UNKNOWN" }
        });

        const command = new Acronyms();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assertErrorReply(interaction, "COMMAND_ACRONYMS_NOT_FOUND");
    });

    it("should handle case-insensitive acronym lookup", async () => {        const interaction = createMockInteraction({
            optionsData: { acronym: "cls" }
        });

        const command = new Acronyms();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds, "Expected embed reply");

        // Should still find CLS even with lowercase input
        assertEmbedField(interaction, "Results", "Commander Luke Skywalker");
    });

    it("should handle partial matches in multi-acronym input", async () => {        const interaction = createMockInteraction({
            optionsData: { acronym: "CLS UNKNOWN JKR" }
        });

        const command = new Acronyms();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds, "Expected embed reply");

        const embed = reply.embeds[0];
        const resultsField = embed.fields.find((f: any) => f.name === "Results");
        assert.ok(resultsField, "Expected Results field");

        // Should include valid acronyms, exclude unknown ones
        assert.ok(resultsField.value.includes("Commander Luke Skywalker"), "Expected CLS definition");
        assert.ok(resultsField.value.includes("Jedi Knight Revan"), "Expected JKR definition");
        assert.ok(!resultsField.value.includes("UNKNOWN"), "Should not include unknown acronym");
    });
});
