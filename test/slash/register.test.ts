import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import Register from "../../slash/register.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Register", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new Register();
        assert.strictEqual(command.commandData.name, "register");
    });

    it("should return error for invalid ally code format", async () => {
        const interaction = createMockInteraction({
            optionsData: { allycode: "invalid" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "NOT__ a valid ally code");
    });

    it("should return error for ally code that is too short", async () => {
        const interaction = createMockInteraction({
            optionsData: { allycode: "12345" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "NOT__ a valid ally code");
    });

    it("should return error when changing another user without admin permissions", async () => {
        // Valid allycode format, but user is different and permLevel < GUILD_ADMIN (6)
        const otherUser = { id: "other-user-id-999", username: "OtherUser" } as any;
        const interaction = createMockInteraction({
            optionsData: {
                allycode: "123456789",
                user: otherUser,
            },
        });
        const ctx = createCommandContext({ interaction, permLevel: 0 });
        const command = new Register();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_SHARDTIMES_MISSING_ROLE");
    });
});
