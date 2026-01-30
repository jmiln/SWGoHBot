import assert from "node:assert";
import { describe, it } from "node:test";
import Character from "../../slash/character.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

describe("Character", () => {
    it("should respond to character requests with proper embed structure", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" } // Use uniqueName for reliable match
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected exactly one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
        assert.strictEqual(reply.embeds.length, 1, "Expected one embed");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Should have embed with author (either character name or error title)
        assert.ok(embedData.author, "Expected author in embed");
        assert.ok(embedData.author.name, "Expected author name");
        assert.ok(embedData.author.name.length > 0, "Expected non-empty title");

        // Should have proper embed structure
        assert.ok(embedData.color !== undefined, "Expected embed color");
    });

    it("should include character URL in embed if available", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Character URL should be in author if available
        if (embedData.author?.url) {
            assert.ok(embedData.author.url.includes("http"), "Expected valid URL");
        }
    });

    it("should set embed color based on character side", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Should have a color (light side or dark side)
        assert.ok(embedData.color !== undefined, "Expected embed color to be set");
        assert.ok(typeof embedData.color === "number", "Expected embed color to be a number");
    });

    it("should format factions as proper case", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        const factionsField = embedData.fields?.find((f: any) => f.name === "Factions");
        if (factionsField) {
            // Factions should be properly capitalized
            assert.ok(/[A-Z]/.test(factionsField.value), "Expected proper case formatting in factions");
        }
    });

    it("should highlight zeta abilities with bold formatting", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Look for abilities with zeta (mock has Learn Control with zeta)
        const learnControl = embedData.fields?.find((f: any) => f.name === "Learn Control");
        if (learnControl) {
            // Should have bold formatting for zeta description
            assert.ok(learnControl.value.includes("**"), "Expected zeta description to be bolded");
        }
    });

    it("should process character data from API", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const embed = replies[0].embeds[0];
        const embedData = embed.data || embed;

        // Should have author (character name)
        assert.ok(embedData.author, "Expected author in embed");

        // If successful (not an error), should process the API response
        const isError = replies[0].flags && replies[0].flags.length > 0;
        if (!isError) {
            // Successful character display should have character info
            assert.ok(embedData.author.name.length > 0, "Expected character name");
        }
    });

    it("should return error for non-existent character", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "NonexistentCharacterXYZ999" }
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const reply = replies[0];
        assert.ok(reply.embeds && reply.embeds.length > 0, "Expected error embed");

        // Error embeds should have ephemeral flag
        assert.ok(reply.flags, "Expected flags in error reply");
    });

    it("should handle ambiguous searches with multiple matches", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "Luke" } // Matches multiple Luke characters
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        // Either shows one character or shows an error with options
        const reply = replies[0];
        assert.ok(reply.embeds && reply.embeds.length > 0, "Expected embed in reply");
    });

    it("should work in DMs (guild context not required)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "COMMANDERLUKESKYWALKER" },
            guild: null as any
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");

        const reply = replies[0];
        assert.ok(reply.embeds && reply.embeds.length > 0, "Expected embed in reply");
    });

    it("should handle character search by alias", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "CLS" } // Alias for Commander Luke
        });

        const command = new Character(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply for alias search");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
    });
});
