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

    it("should work without guild context (guildOnly: false)", async () => {        const interaction = createMockInteraction({
            optionsData: { _subcommand: "benefits" },
            guild: null as any
        });

        const command = new Patreon();
        await command.run({ interaction, language: (interaction as any).language });

        assertReplyCount(interaction, 1);
    });

    it("should send exactly one reply", async () => {        const interaction = createMockInteraction({
            optionsData: { _subcommand: "benefits" }
        });

        const command = new Patreon();
        await command.run({ interaction, language: (interaction as any).language });

        assertReplyCount(interaction, 1);
    });

    it("should have correct command configuration", () => {        const command = new Patreon();

        assert.strictEqual(command.commandData.name, "patreon", "Expected command name to be 'patreon'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 6, "Expected 6 subcommands");

        const benefitsOpt = command.commandData.options.find(o => o.name === "benefits");
        const commandsOpt = command.commandData.options.find(o => o.name === "commands");
        const cooldownsOpt = command.commandData.options.find(o => o.name === "cooldowns");
        const myInfoOpt = command.commandData.options.find(o => o.name === "my_info");
        const setServerOpt = command.commandData.options.find(o => o.name === "set_server");
        const unsetServerOpt = command.commandData.options.find(o => o.name === "unset_server");

        assert.ok(benefitsOpt, "Expected benefits subcommand");
        assert.ok(commandsOpt, "Expected commands subcommand");
        assert.ok(cooldownsOpt, "Expected cooldowns subcommand");
        assert.ok(myInfoOpt, "Expected my_info subcommand");
        assert.ok(setServerOpt, "Expected set_server subcommand");
        assert.ok(unsetServerOpt, "Expected unset_server subcommand");
    });
});
