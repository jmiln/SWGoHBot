import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import UserConf from "../../slash/userconf.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("UserConf", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new UserConf();
        assert.strictEqual(command.commandData.name, "userconf");
    });

    it("should have allycodes subcommand group with add, remove, make_primary", () => {
        const command = new UserConf();
        const allycodesGroup = command.commandData.options.find((o: any) => o.name === "allycodes");
        assert.ok(allycodesGroup, "Expected allycodes subcommand group");
        const subNames = allycodesGroup.options.map((o: any) => o.name);
        assert.ok(subNames.includes("add"), "Expected add subcommand");
        assert.ok(subNames.includes("remove"), "Expected remove subcommand");
        assert.ok(subNames.includes("make_primary"), "Expected make_primary subcommand");
    });

    it("should have arenaalert, lang, and view subcommands", () => {
        const command = new UserConf();
        const optionNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(optionNames.includes("arenaalert"), "Expected arenaalert subcommand");
        assert.ok(optionNames.includes("lang"), "Expected lang subcommand");
        assert.ok(optionNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when ally code format is invalid", async () => {
        // patreonFuncs.getPlayerCooldown + userReg.getUser run first (MongoDB), then isAllyCode check
        const interaction = createMockInteraction({
            optionsData: { _subcommandGroup: "allycodes", _subcommand: "add", allycode: "not-a-code" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new UserConf();
        await command.run(ctx);
        assertErrorReply(interaction, "is not a valid ally code");
    });
});
