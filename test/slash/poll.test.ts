import assert from "node:assert";
import { describe, it } from "node:test";
import Poll from "../../slash/poll.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Poll", () => {
    it("should initialize with correct name", () => {
        const command = new Poll();
        assert.strictEqual(command.commandData.name, "poll");
    });

    it("should have all required subcommands", () => {
        const command = new Poll();
        const options = command.commandData.options;
        const subcommandNames = options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("create"), "Expected 'create' subcommand");
        assert.ok(subcommandNames.includes("end"), "Expected 'end' subcommand");
        assert.ok(subcommandNames.includes("cancel"), "Expected 'cancel' subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected 'view' subcommand");
        assert.ok(subcommandNames.includes("vote"), "Expected 'vote' subcommand");
    });

    it("should return error in DM context (no guild)", async () => {
        // poll.ts reads interaction.channel.id before checking guild, so provide a channel.
        // Setting guild: null triggers the DM error check.
        const interaction = createMockInteraction({
            guild: null as any,
            channel: { id: "channel123" } as any,
            optionsData: { _subcommand: "create", question: "Test?", options: "A|B" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Poll();
        await command.run(ctx);
        assertErrorReply(interaction, "not available in DMs");
    });

    it("should work without guild context (guildOnly: false)", () => {
        const command = new Poll();
        assert.strictEqual(command.commandData.guildOnly, false);
    });
});
