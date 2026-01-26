import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot } from "../mocks/index.ts";
import WhoIs from "../../slash/whois.ts";

describe("WhoIs", () => {
    // Note: Full whois tests require swgohAPI and database.
    // We test command configuration only.

    it("should work without guild context (guildOnly: false)", () => {
        const bot = createMockBot();
        const command = new WhoIs(bot);

        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
    });

    it("should have correct command configuration", () => {
        const bot = createMockBot();
        const command = new WhoIs(bot);

        assert.strictEqual(command.commandData.name, "whois", "Expected command name to be 'whois'");
        assert.strictEqual(command.commandData.guildOnly, false, "Expected guildOnly to be false");
        assert.ok(command.commandData.options, "Expected options to be defined");
        assert.strictEqual(command.commandData.options.length, 1, "Expected 1 option");
    });

    it("should have required name option", () => {
        const bot = createMockBot();
        const command = new WhoIs(bot);

        const nameOpt = command.commandData.options.find(o => o.name === "name");
        assert.ok(nameOpt, "Expected name option");
        assert.strictEqual(nameOpt.required, true, "Expected name to be required");
        assert.strictEqual(nameOpt.type, 3, "Expected String type (3)");
    });
});
