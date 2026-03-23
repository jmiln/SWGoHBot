import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import { getAllStrikes, getActiveStrikes } from "../../modules/guildConfig/strikes.ts";
import swgohAPI from "../../modules/swapi.ts";
import Strike from "../../slash/strike.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { MockSWAPI, createMockPlayer } from "../mocks/mockSwapi.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

const GUILD_ID = "987654321";
const ADMIN_PERM = 6;
const USER_PERM = 0;
const PLAYER_AC = 123456789;
const PLAYER_AC_2 = 999999999;

async function seedPlayer(allyCode: number, name: string) {
    await cache.put(
        env.MONGODB_SWAPI_DB,
        "players",
        { allyCode },
        { allyCode, name, guildId: "game-guild-1", guildName: "Test Guild Game" } as never,
        false,
    );
}

function makeCtx(subcommand: string, optionsData: Record<string, string | number | boolean> = {}, permLevel = ADMIN_PERM) {
    const interaction = createMockInteraction({
        guild: { id: GUILD_ID, name: "Test Guild" } as any,
        optionsData: { _subcommand: subcommand, ...optionsData },
    });
    return { interaction, ctx: createCommandContext({ interaction, permLevel }) };
}

describe("Strike command", () => {
    let mockSwapi: MockSWAPI;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    beforeEach(async () => {
        mockSwapi = new MockSWAPI();
        (swgohAPI as any).player = mockSwapi.player.bind(mockSwapi);
        await guildConfigDB.put({ guildId: GUILD_ID }, { strikes: [] } as never, false);
        await cache.remove(env.MONGODB_SWAPI_DB, "players", { allyCode: { $in: [PLAYER_AC, PLAYER_AC_2] } });
    });

    it("should have name 'strike'", () => {
        assert.strictEqual(new Strike().commandData.name, "strike");
    });

    it("should have all five subcommands", () => {
        const names = new Strike().commandData.options.map((o: any) => o.name);
        for (const name of ["add", "revoke", "clear", "view", "list"]) {
            assert.ok(names.includes(name), `Missing subcommand: ${name}`);
        }
    });

    describe("add subcommand", () => {
        it("returns permission error for non-admin", async () => {
            const { interaction, ctx } = makeCtx("add", { allycode: PLAYER_AC, reason: "test" }, USER_PERM);
            await new Strike().run(ctx);
            assertErrorReply(interaction, "admin role");
        });

        it("returns error when player not found in cache or swapi", async () => {
            const { interaction, ctx } = makeCtx("add", { allycode: PLAYER_AC, reason: "test" });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "No player found");
        });

        it("adds a strike for player found via swapi but not in cache", async () => {
            mockSwapi.setPlayerData(createMockPlayer({ allyCode: PLAYER_AC, name: "SwapiPlayer", guildId: "game-guild-1", guildName: "Test Guild Game" }));
            const { ctx } = makeCtx("add", { allycode: PLAYER_AC, reason: "Missed TW attacks" });
            await new Strike().run(ctx);

            const all = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(all.length, 1);
            assert.strictEqual(all[0].playerName, "SwapiPlayer");
            assert.strictEqual(all[0].strikes[0].reason, "Missed TW attacks");
        });

        it("adds a strike and replies with success", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            const { ctx } = makeCtx("add", { allycode: PLAYER_AC, reason: "Missed TW attacks" });
            await new Strike().run(ctx);

            const all = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(all.length, 1);
            assert.strictEqual(all[0].strikes[0].reason, "Missed TW attacks");
        });

        it("sets expiresAt when expires option is provided", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            const before = Date.now();
            const { ctx } = makeCtx("add", { allycode: PLAYER_AC, reason: "Zero tickets", expires: 14 });
            await new Strike().run(ctx);
            const after = Date.now();

            const all = await getAllStrikes({ guildId: GUILD_ID });
            const expiresAt = all[0].strikes[0].expiresAt;
            assert.ok(expiresAt, "Expected expiresAt to be set");
            assert.ok(expiresAt >= before + 14 * 86400000, "expiresAt too early");
            assert.ok(expiresAt <= after + 14 * 86400000, "expiresAt too late");
        });
    });

    describe("revoke subcommand", () => {
        it("returns permission error for non-admin", async () => {
            const { interaction, ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: "abc" }, USER_PERM);
            await new Strike().run(ctx);
            assertErrorReply(interaction, "admin role");
        });

        it("returns error when player has no record", async () => {
            const { interaction, ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: "abc" });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "No strikes found");
        });

        it("returns error when strike_id is not found", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            const addCtx = makeCtx("add", { allycode: PLAYER_AC, reason: "test" });
            await new Strike().run(addCtx.ctx);

            const { interaction, ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: "wrong-id" });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "Strike not found");
        });

        it("returns error when strike is already revoked", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "test" }).ctx);
            const all = await getAllStrikes({ guildId: GUILD_ID });
            const strikeId = all[0].strikes[0].id;

            await new Strike().run(makeCtx("revoke", { allycode: PLAYER_AC, strike_id: strikeId }).ctx);
            const { interaction, ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: strikeId });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "already been revoked");
        });

        it("revokes an expired strike — strike remains in record with removedAt set", async () => {
            await guildConfigDB.put(
                { guildId: GUILD_ID },
                {
                    strikes: [{
                        allyCode: PLAYER_AC, playerName: "TestPlayer", guildId: "g1", guildName: "G1",
                        strikes: [{ id: "exp-id", reason: "Old", issuedBy: "u1", issuedAt: Date.now() - 200000, expiresAt: Date.now() - 1000 }],
                    }],
                } as never,
                false,
            );

            const { ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: "exp-id" });
            await new Strike().run(ctx);
            const after = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(after[0].strikes.length, 1, "Strike should remain in record");
            assert.ok(after[0].strikes[0].removedAt, "removedAt should be set");
        });

        it("revokes an active strike — strike remains in history, not counted as active", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "test" }).ctx);

            const all = await getAllStrikes({ guildId: GUILD_ID });
            const strikeId = all[0].strikes[0].id;

            const { ctx } = makeCtx("revoke", { allycode: PLAYER_AC, strike_id: strikeId });
            await new Strike().run(ctx);

            const after = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(after[0].strikes.length, 1, "Strike should remain in record");
            assert.strictEqual(getActiveStrikes(after[0].strikes).length, 0, "Revoked strike should not be active");
        });
    });

    describe("clear subcommand", () => {
        it("returns permission error for non-admin", async () => {
            const { interaction, ctx } = makeCtx("clear", { allycode: PLAYER_AC }, USER_PERM);
            await new Strike().run(ctx);
            assertErrorReply(interaction, "admin role");
        });

        it("returns error when player has no record", async () => {
            const { interaction, ctx } = makeCtx("clear", { allycode: PLAYER_AC });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "No strikes found");
        });

        it("clears all strikes for a player", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            const addCtx = makeCtx("add", { allycode: PLAYER_AC, reason: "test" });
            await new Strike().run(addCtx.ctx);

            const { ctx } = makeCtx("clear", { allycode: PLAYER_AC });
            await new Strike().run(ctx);

            const after = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(after.length, 0);
        });
    });

    describe("view subcommand", () => {
        it("returns error when player has no record", async () => {
            const { interaction, ctx } = makeCtx("view", { allycode: PLAYER_AC });
            await new Strike().run(ctx);
            assertErrorReply(interaction, "No strikes found");
        });

        it("shows active strikes section", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "Missed TW" }).ctx);

            const { interaction, ctx } = makeCtx("view", { allycode: PLAYER_AC });
            await new Strike().run(ctx);

            const reply = getLastReply(interaction);
            const embed = reply?.embeds?.[0]?.data || reply?.embeds?.[0];
            assert.ok(
                embed?.fields?.some((f: any) => f.name.toLowerCase().includes("active")),
                "Expected active strikes field",
            );
        });

        it("shows 'no active strikes' when all strikes are expired", async () => {
            await guildConfigDB.put(
                { guildId: GUILD_ID },
                {
                    strikes: [{
                        allyCode: PLAYER_AC, playerName: "TestPlayer", guildId: "g1", guildName: "G1",
                        strikes: [{ id: "exp1", reason: "Old offense", issuedBy: "u1", issuedAt: Date.now() - 200000, expiresAt: Date.now() - 1000 }],
                    }],
                } as never,
                false,
            );

            const { interaction, ctx } = makeCtx("view", { allycode: PLAYER_AC });
            await new Strike().run(ctx);

            const embed = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0]);
            const activeField = embed?.fields?.find((f: any) => f.name.toLowerCase().includes("active"));
            assert.ok(activeField?.value?.toLowerCase().includes("no active"), "Expected 'no active strikes' text");
        });

        it("shows history section when expired strikes exist", async () => {
            await guildConfigDB.put(
                { guildId: GUILD_ID },
                {
                    strikes: [{
                        allyCode: PLAYER_AC, playerName: "TestPlayer", guildId: "g1", guildName: "G1",
                        strikes: [
                            { id: "a1", reason: "Active", issuedBy: "u1", issuedAt: Date.now() },
                            { id: "e1", reason: "Expired", issuedBy: "u1", issuedAt: Date.now() - 200000, expiresAt: Date.now() - 1000 },
                        ],
                    }],
                } as never,
                false,
            );

            const { interaction, ctx } = makeCtx("view", { allycode: PLAYER_AC });
            await new Strike().run(ctx);

            const embed = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0]);
            assert.ok(
                embed?.fields?.some((f: any) => f.name.toLowerCase().includes("history")),
                "Expected history field when expired strikes exist",
            );
        });

        it("omits history section when no expired strikes exist", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "Active only" }).ctx);

            const { interaction, ctx } = makeCtx("view", { allycode: PLAYER_AC });
            await new Strike().run(ctx);

            const embed = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0]);
            assert.ok(
                !embed?.fields?.some((f: any) => f.name.toLowerCase().includes("history")),
                "Expected no history field when no expired strikes",
            );
        });
    });

    describe("autocomplete: strike_id", () => {
        function makeAutocompleteInteraction(subcommand: string, options: Record<string, string | number> = {}) {
            let _responded: any[] | null = null;
            return {
                guild: { id: GUILD_ID },
                options: {
                    getSubcommand: () => subcommand,
                    getInteger: (name: string) => options[name] ?? null,
                },
                respond: async (choices: any[]) => {
                    _responded = choices;
                },
                _getResponded: () => _responded,
            } as any;
        }

        it("returns empty when no record exists for the allycode", async () => {
            const interaction = makeAutocompleteInteraction("revoke", { allycode: PLAYER_AC });
            await new Strike().autocomplete(interaction, { name: "strike_id", value: "" } as any);
            assert.deepStrictEqual(interaction._getResponded(), []);
        });

        it("includes active strikes without [expired] label", async () => {
            await seedPlayer(PLAYER_AC, "TestPlayer");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "Active offense" }).ctx);

            const all = await getAllStrikes({ guildId: GUILD_ID });
            const strikeId = all[0].strikes[0].id;

            const interaction = makeAutocompleteInteraction("revoke", { allycode: PLAYER_AC });
            await new Strike().autocomplete(interaction, { name: "strike_id", value: "" } as any);

            const choices = interaction._getResponded();
            assert.strictEqual(choices.length, 1);
            assert.strictEqual(choices[0].value, strikeId);
            assert.ok(!choices[0].name.includes("[expired]"), "Active strike should not have [expired] label");
        });

        it("includes expired strikes with [expired] label", async () => {
            await guildConfigDB.put(
                { guildId: GUILD_ID },
                {
                    strikes: [{
                        allyCode: PLAYER_AC, playerName: "TestPlayer", guildId: "g1", guildName: "G1",
                        strikes: [
                            { id: "active-id", reason: "Recent offense", issuedBy: "u1", issuedAt: Date.now() },
                            { id: "exp-id", reason: "Old offense", issuedBy: "u1", issuedAt: Date.now() - 200000, expiresAt: Date.now() - 1000 },
                        ],
                    }],
                } as never,
                false,
            );

            const interaction = makeAutocompleteInteraction("revoke", { allycode: PLAYER_AC });
            await new Strike().autocomplete(interaction, { name: "strike_id", value: "" } as any);

            const choices = interaction._getResponded();
            assert.strictEqual(choices.length, 2);
            const expiredChoice = choices.find((c: any) => c.value === "exp-id");
            const activeChoice = choices.find((c: any) => c.value === "active-id");
            assert.ok(expiredChoice?.name.startsWith("[expired]"), "Expired strike should have [expired] label");
            assert.ok(!activeChoice?.name.includes("[expired]"), "Active strike should not have [expired] label");
        });
    });

    describe("list subcommand", () => {
        it("shows empty message when no strikes exist", async () => {
            const { interaction, ctx } = makeCtx("list", {});
            await new Strike().run(ctx);
            const reply = getLastReply(interaction);
            assert.ok(reply, "Expected a reply");
            const embed = reply?.embeds?.[0]?.data || reply?.embeds?.[0];
            assert.ok(embed?.description?.includes("No members"), "Expected empty list message");
        });

        it("lists players with active strikes", async () => {
            await seedPlayer(PLAYER_AC, "Player1");
            await seedPlayer(PLAYER_AC_2, "Player2");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "test1" }).ctx);
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC_2, reason: "test2" }).ctx);

            const { interaction, ctx } = makeCtx("list", {});
            await new Strike().run(ctx);

            const embed = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0]);
            assert.ok(embed?.description?.includes("Player1"), "Expected Player1 in list");
            assert.ok(embed?.description?.includes("Player2"), "Expected Player2 in list");
        });

        it("excludes players with only expired strikes from the no-filter list", async () => {
            await guildConfigDB.put(
                { guildId: GUILD_ID },
                {
                    strikes: [{
                        allyCode: PLAYER_AC, playerName: "ExpiredPlayer", guildId: "g1", guildName: "G1",
                        strikes: [{ id: "e1", reason: "Old", issuedBy: "u1", issuedAt: Date.now() - 200000, expiresAt: Date.now() - 1000 }],
                    }],
                } as never,
                false,
            );

            const { interaction, ctx } = makeCtx("list", {});
            await new Strike().run(ctx);

            const embed = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0]);
            assert.ok(!embed?.description?.includes("ExpiredPlayer"), "Expired-only players should not appear in list");
        });

        it("sorts by name by default (alphabetical)", async () => {
            await seedPlayer(PLAYER_AC, "Zara");
            await seedPlayer(PLAYER_AC_2, "Alice");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "test" }).ctx);
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC_2, reason: "test" }).ctx);

            const { interaction, ctx } = makeCtx("list", {});
            await new Strike().run(ctx);

            const desc = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0])?.description ?? "";
            assert.ok(desc.indexOf("Alice") < desc.indexOf("Zara"), "Expected Alice before Zara when sorted by name");
        });

        it("sorts by strikes highest first when sort=strikes", async () => {
            await seedPlayer(PLAYER_AC, "OneStrike");
            await seedPlayer(PLAYER_AC_2, "TwoStrikes");
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC, reason: "first" }).ctx);
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC_2, reason: "first" }).ctx);
            await new Strike().run(makeCtx("add", { allycode: PLAYER_AC_2, reason: "second" }).ctx);

            const { interaction, ctx } = makeCtx("list", { sort: "strikes" });
            await new Strike().run(ctx);

            const desc = (getLastReply(interaction)?.embeds?.[0]?.data || getLastReply(interaction)?.embeds?.[0])?.description ?? "";
            assert.ok(desc.indexOf("TwoStrikes") < desc.indexOf("OneStrike"), "Expected TwoStrikes before OneStrike when sorted by strikes");
        });
    });
});
