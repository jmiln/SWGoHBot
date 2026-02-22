import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import SetConf from "../../slash/setconf.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("SetConf", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new SetConf();
        assert.strictEqual(command.commandData.name, "setconf");
    });

    it("should require admin permissions (permLevel: 3)", () => {
        const command = new SetConf();
        assert.strictEqual(command.commandData.permLevel, 3);
    });

    it("should have set, add, remove, and twlist options", () => {
        const command = new SetConf();
        const optionNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(optionNames.includes("set"), "Expected set subcommand");
        assert.ok(optionNames.includes("add"), "Expected add subcommand");
        assert.ok(optionNames.includes("remove"), "Expected remove subcommand");
        assert.ok(optionNames.includes("twlist"), "Expected twlist subcommand group");
    });

    it("should return error when run outside a guild", async () => {
        // !interaction?.guild?.id check fires first, no MongoDB needed
        const interaction = createMockInteraction({ guild: null as any });
        const ctx = createCommandContext({ interaction });
        const command = new SetConf();
        await command.run(ctx);
        assertErrorReply(interaction, "only usable in servers");
    });

    it("should return error when set subcommand has no options to update", async () => {
        // getGuildSettings returns defaultSettings (not null), set subcommand with no options → nothing to update
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "set" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new SetConf();
        await command.run(ctx);
        assertErrorReply(interaction, "nothing needed to be updated");
    });
});
