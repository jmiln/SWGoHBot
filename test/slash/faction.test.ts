import assert from "node:assert";
import { describe, it } from "node:test";
import Faction from "../../slash/faction.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Faction", () => {
    // Note: Full faction tests require MongoDB and the swgohAPI module.
    // We test error cases and basic validation logic.

    it("should return error when both faction groups are selected", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: {
                faction_group_1: "SITH",
                faction_group_2: "JEDI"
            }
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "one faction at a time");
    });

    it("should return error when no faction is selected", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: {}
        });

        const command = new Faction(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "need to select a faction");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new Faction(bot);

        assert.strictEqual(command.commandData.name, "faction", "Expected command name to be 'faction'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 5, "Expected 5 options");

        // Check that faction groups exist
        const factionGroup1 = command.commandData.options.find(o => o.name === "faction_group_1");
        const factionGroup2 = command.commandData.options.find(o => o.name === "faction_group_2");
        assert.ok(factionGroup1, "Expected faction_group_1 option");
        assert.ok(factionGroup2, "Expected faction_group_2 option");

        // Check other options
        const allycodeOpt = command.commandData.options.find(o => o.name === "allycode");
        const leaderOpt = command.commandData.options.find(o => o.name === "leader");
        const zetaOpt = command.commandData.options.find(o => o.name === "zeta");

        assert.ok(allycodeOpt, "Expected allycode option");
        assert.ok(leaderOpt, "Expected leader option");
        assert.ok(zetaOpt, "Expected zeta option");
    });
});
