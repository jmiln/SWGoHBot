import assert from "node:assert";
import { describe, it } from "node:test";
import Patreon from "../../slash/patreon.ts";
import { createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount } from "./helpers.ts";

describe("Patreon", () => {
    // Note: Full patreon tests require MongoDB and patreon API.
    // We test static data display and command configuration.

    it("should display benefits for all tiers", async () => {        const interaction = createMockInteraction({
            optionsData: { _subcommand: "benefits" }
        });

        const command = new Patreon();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
        assert.ok(reply.embeds[0].fields, "Expected fields in embed");
        assert.ok(reply.embeds[0].fields.length > 0, "Expected benefit tier fields");

        // Should have fields for different tiers ($1, $5, $10)
        const tierFields = reply.embeds[0].fields.filter((f: any) => f.name.includes("$"));
        assert.ok(tierFields.length > 0, "Expected tier fields with pricing");
    });

    it("should display patreon commands", async () => {        const interaction = createMockInteraction({
            optionsData: { _subcommand: "commands" }
        });

        const command = new Patreon();
        await command.run({ interaction, language: (interaction as any).language });

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected embeds in reply");
        assert.ok(reply.embeds[0].fields, "Expected fields in embed");

        const commandField = reply.embeds[0].fields.find((f: any) => f.name === "Patreon Commands");
        assert.ok(commandField, "Expected 'Patreon Commands' field");
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction({
            optionsData: { _subcommand: "benefits" }
        });

        const command = new Patreon();
        await command.run({ interaction, language: (interaction as any).language });

        assertReplyCount(interaction, 1);
    });
});
