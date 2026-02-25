import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import Panic from "../../slash/panic.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Panic", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new Panic();
        assert.strictEqual(command.commandData.name, "panic");
    });

    it("should return error for unit not in journey requirements when allycode is provided", async () => {
        // With a literal 9-digit allycode, getAllyCode returns without hitting MongoDB.
        // The journeyReqs check happens before fetchPlayerWithCooldown, so no swgohAPI mock needed.
        const interaction = createMockInteraction({
            optionsData: {
                unit: "UNIT_DOES_NOT_EXIST_IN_JOURNEY_REQS",
                allycode: "123456789",
            },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Panic();
        await command.run(ctx);
        assertErrorReply(interaction, "Please select one of the autocompleted options");
    });

    it("should return error when no allycode is registered and none provided", async () => {
        // No allycode provided, user not registered → getAllyCode returns null → immediate error
        const interaction = createMockInteraction({
            optionsData: { unit: "GLEOR_V2" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new Panic();
        await command.run(ctx);
        assertErrorReply(interaction, "could not find a valid allycode");
    });
});
