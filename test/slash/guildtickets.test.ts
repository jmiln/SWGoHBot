import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import GuildTickets from "../../slash/guildtickets.ts";
import type { PatronUser, UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("GuildTickets", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new GuildTickets();
        assert.strictEqual(command.commandData.name, "guildtickets");
    });

    it("should have set and view subcommands", () => {
        const command = new GuildTickets();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("set"), "Expected set subcommand");
        assert.ok(subcommandNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when user has no data", async () => {
        // userReg.getUser returns null for unregistered user → early error
        const interaction = createMockInteraction({ optionsData: { _subcommand: "view" } });
        const ctx = createCommandContext({ interaction });
        const command = new GuildTickets();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_DATA_NOT_FOUND");
    });

    describe("set allycode", () => {
        const GT_SLASH_USER_ID = "guildtickets_slash_user";

        beforeEach(async () => {
            await cache.remove(env.MONGODB_SWGOHBOT_DB, "users", { id: GT_SLASH_USER_ID });
        });

        after(async () => {
            await cache.remove(env.MONGODB_SWGOHBOT_DB, "users", { id: GT_SLASH_USER_ID });
        });

        it("clears the previous guild's saved reset time so the watcher refetches it", async (t) => {
            await cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: GT_SLASH_USER_ID }, {
                id: GT_SLASH_USER_ID,
                accounts: [],
                guildTickets: {
                    enabled: true,
                    allyCode: 111222333,
                    channel: "gt-chan",
                    updateType: "msg",
                    nextChallengesRefresh: "1790713776",
                },
            } as unknown as UserConfig);
            t.mock.method(patreonFuncs, "getPatronUser", async () => ({ amount_cents: 100 }) as PatronUser);
            t.mock.method(swgohAPI, "unitStats", async () => [{ allyCode: 444555666 }]);

            const interaction = createMockInteraction({
                user: { id: GT_SLASH_USER_ID, username: "TicketWatcher" },
                optionsData: { _subcommand: "set", allycode: "444555666" },
            });
            await new GuildTickets().run(createCommandContext({ interaction }));

            const saved = await userReg.getUser(GT_SLASH_USER_ID);
            assert.strictEqual(saved?.guildTickets?.allyCode, 444555666, "the new ally code should be saved");
            assert.ok(
                !saved?.guildTickets?.nextChallengesRefresh,
                `expected the old reset time cleared, got: ${saved?.guildTickets?.nextChallengesRefresh}`,
            );
        });
    });
});
