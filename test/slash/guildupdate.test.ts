import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import GuildUpdate from "../../slash/guildupdate.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("GuildUpdate", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new GuildUpdate();
        assert.strictEqual(command.commandData.name, "guildupdate");
    });

    it("should have set and view subcommands", () => {
        const command = new GuildUpdate();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("set"), "Expected set subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when user has no data", async () => {
        // userReg.getUser returns null for unregistered user → early error
        const interaction = createMockInteraction({ optionsData: { _subcommand: "view" } });
        const ctx = createCommandContext({ interaction });
        const command = new GuildUpdate();
        await command.run(ctx);
        assertErrorReply(interaction, "something went wrong");
    });
});
