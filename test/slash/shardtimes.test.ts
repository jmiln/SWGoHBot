import assert from "node:assert";
import { describe, it } from "node:test";
import Shardtimes from "../../slash/shardtimes.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Shardtimes", () => {
    it("should initialize with correct name", () => {
        const command = new Shardtimes();
        assert.strictEqual(command.commandData.name, "shardtimes");
    });

    it("should have add, remove, copy, and view subcommands", () => {
        const command = new Shardtimes();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("add"), "Expected add subcommand");
        assert.ok(subcommandNames.includes("remove"), "Expected remove subcommand");
        assert.ok(subcommandNames.includes("copy"), "Expected copy subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when no channel is present (DM context)", async () => {
        // Default mock has no channel — !interaction.channel fires immediately, no MongoDB needed
        const interaction = createMockInteraction({ optionsData: { _subcommand: "view" } });
        const ctx = createCommandContext({ interaction });
        const command = new Shardtimes();
        await command.run(ctx);
        assertErrorReply(interaction, "not available in DMs");
    });
});
