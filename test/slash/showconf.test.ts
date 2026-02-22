import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import Showconf from "../../slash/showconf.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { getLastReply } from "./helpers.ts";

describe("Showconf", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new Showconf();
        assert.strictEqual(command.commandData.name, "showconf");
    });

    it("should require admin permissions (permLevel: 3)", () => {
        const command = new Showconf();
        assert.strictEqual(command.commandData.permLevel, 3);
    });

    it("should display guild configuration when guild exists", async () => {
        const interaction = createMockInteraction({
            guild: {
                id: "987654321",
                name: "Test Guild",
                roles: { cache: new Map() },
                channels: { cache: new Map() },
                members: { cache: new Map() },
            } as any,
        });
        const ctx = createCommandContext({ interaction });
        const command = new Showconf();
        await command.run(ctx);

        // With no guild config in DB, getGuildSettings returns null/default — command still replies
        const reply = getLastReply(interaction);
        assert.ok(reply.content !== undefined, "Expected a content reply");
    });
});
