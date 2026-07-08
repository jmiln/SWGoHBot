import assert from "node:assert";
import { describe, it } from "node:test";
import Help from "../../slash/help.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

// Collect every field value across all replies (the command spills past 4 fields into a followUp).
function allFieldValues(interaction: any): string {
    return interaction
        ._getReplies()
        .flatMap((r: any) => (r.embeds ?? []).flatMap((e: any) => ((e.data || e).fields ?? []).map((f: any) => f.value)))
        .join("\n");
}

describe("Help", () => {
    // Field names carry the (upper-cased) category, so collect them across every reply.
    function allFieldNames(interaction: any): string[] {
        return interaction
            ._getReplies()
            .flatMap((r: any) => (r.embeds ?? []).flatMap((e: any) => ((e.data || e).fields ?? []).map((f: any) => f.name)));
    }

    it("should display all commands when no options provided", async () => {
        const interaction = createMockInteraction();

        await new Help().run(createCommandContext({ interaction }));

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const embed = replies[0].embeds[0];
        assert.strictEqual(embed.title, "Slash Commands List", "Expected proper title");
        assert.ok(embed.description?.includes("required"), "Expected usage hint");

        // Every category from help.json should be represented across the reply(s).
        const names = allFieldNames(interaction);
        for (const cat of ["GENERAL", "ADMIN", "PATREON", "GAMEDATA"]) {
            assert.ok(names.includes(cat), `Expected the ${cat} category to be listed`);
        }
    });

    it("should cap the first embed at 4 fields and spill the rest into a followUp", async () => {
        const interaction = createMockInteraction();

        await new Help().run(createCommandContext({ interaction }));

        const replies = (interaction as any)._getReplies();
        // The four categories chunk into more than four fields, so the command caps the first embed
        // at 4 and sends the remainder as a second message.
        assert.ok(replies[0].embeds[0].fields.length <= 4, "Expected the first embed to be capped at 4 fields");
        assert.strictEqual(replies.length, 2, "Expected a followUp for the overflow fields");
    });

    it("should filter commands by category", async () => {
        const interaction = createMockInteraction({ optionsData: { category: "General" } });

        await new Help().run(createCommandContext({ interaction }));

        const embed = (interaction as any)._getReplies()[0].embeds[0];
        assert.ok(embed.fields?.length > 0, "Expected fields");

        // Category field names are the category, upper-cased. Filtering to General must include a
        // GENERAL field and exclude every other category, proving the filter actually narrows output.
        const fieldNames = embed.fields.map((f: any) => f.name);
        assert.ok(fieldNames.includes("GENERAL"), "Expected the GENERAL category field");
        for (const other of ["ADMIN", "GAMEDATA", "PATREON"]) {
            assert.ok(!fieldNames.includes(other), `Did not expect the ${other} category when filtering to General`);
        }
    });

    it("should show specific command details", async () => {
        const interaction = createMockInteraction({ optionsData: { command: "info" } });

        await new Help().run(createCommandContext({ interaction }));

        const embed = (interaction as any)._getReplies()[0].embeds[0];
        assert.ok(embed.title?.toLowerCase().includes("info"), "Expected command name in title");
        assert.ok(embed.description?.includes("/info"), "Expected command in description");
    });

    it("should return error for invalid command", async () => {
        const interaction = createMockInteraction({ optionsData: { command: "nonexistentcommand" } });

        await new Help().run(createCommandContext({ interaction }));

        assertErrorReply(interaction, "COMMAND_HELP_NOT_FOUND");
    });

    it("should show the usage tree only when the details flag is true", async () => {
        const detailed = createMockInteraction({ optionsData: { details: true } });
        await new Help().run(createCommandContext({ interaction: detailed }));

        const plain = createMockInteraction({ optionsData: { details: false } });
        await new Help().run(createCommandContext({ interaction: plain }));

        // formatCmdHelp renders per-usage sub-lines with box-drawing characters only when detailed.
        const treeChars = /[│├└]/;
        assert.ok(treeChars.test(allFieldValues(detailed)), "Expected a usage tree in the detailed output");
        assert.ok(!treeChars.test(allFieldValues(plain)), "Expected no usage tree without the details flag");
    });

    it("should have random color in embed", async () => {
        const interaction = createMockInteraction();

        await new Help().run(createCommandContext({ interaction }));

        const embed = (interaction as any)._getReplies()[0].embeds[0];
        assert.ok(typeof embed.color === "number", "Expected numeric color");
        assert.ok(embed.color >= 0 && embed.color <= 16777215, "Expected valid color range");
    });
});
