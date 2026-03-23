import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import {
    addStrike,
    clearStrikes,
    getAllStrikes,
    getActiveStrikes,
    getPlayerStrikes,
    revokeStrike,
} from "../../modules/guildConfig/strikes.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import type { Strike } from "../../types/guildConfig_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const GUILD_ID = "test-discord-guild-1";
const ALLY_CODE = 123456789;

function makeStrike(overrides: Partial<Strike> = {}): Strike {
    return {
        id: crypto.randomUUID(),
        reason: "Missed TW attacks",
        issuedBy: "officer-user-id",
        issuedAt: Date.now(),
        ...overrides,
    };
}

describe("strikes module", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
    });

    after(async () => {
        await closeMongoClient();
    });

    beforeEach(async () => {
        await guildConfigDB.put({ guildId: GUILD_ID }, { strikes: [] } as never, false);
    });

    describe("getActiveStrikes", () => {
        it("returns all strikes when none have expiry", () => {
            const strikes = [makeStrike(), makeStrike()];
            assert.strictEqual(getActiveStrikes(strikes).length, 2);
        });

        it("excludes strikes where expiresAt is in the past", () => {
            const expired = makeStrike({ expiresAt: Date.now() - 1000 });
            const active = makeStrike();
            const result = getActiveStrikes([expired, active]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, active.id);
        });

        it("includes strikes where expiresAt is in the future", () => {
            const future = makeStrike({ expiresAt: Date.now() + 86400000 });
            assert.strictEqual(getActiveStrikes([future]).length, 1);
        });

        it("excludes revoked strikes even if not expired", () => {
            const revoked = makeStrike({ removedAt: Date.now() - 1000, removedBy: "officer-id" });
            const active = makeStrike();
            const result = getActiveStrikes([revoked, active]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, active.id);
        });

        it("returns empty array for empty input", () => {
            assert.deepStrictEqual(getActiveStrikes([]), []);
        });
    });

    describe("getPlayerStrikes", () => {
        it("returns null when player has no record", async () => {
            const result = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.strictEqual(result, null);
        });

        it("returns the player record after a strike is added", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "game-guild-1", guildName: "Test Guild" },
                strike: makeStrike(),
            });
            const result = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(result);
            assert.strictEqual(result.allyCode, ALLY_CODE);
            assert.strictEqual(result.playerName, "TestPlayer");
        });
    });

    describe("getAllStrikes", () => {
        it("returns empty array when no strikes exist", async () => {
            const result = await getAllStrikes({ guildId: GUILD_ID });
            assert.deepStrictEqual(result, []);
        });

        it("returns all player strike records for the guild", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "Player1", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike(),
            });
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: 999999999, playerName: "Player2", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike(),
            });
            const result = await getAllStrikes({ guildId: GUILD_ID });
            assert.strictEqual(result.length, 2);
        });
    });

    describe("addStrike", () => {
        it("creates a new player entry on first strike", async () => {
            const strike = makeStrike();
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike,
            });
            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(record);
            assert.strictEqual(record.strikes.length, 1);
            assert.strictEqual(record.strikes[0].id, strike.id);
        });

        it("appends to an existing player entry on second strike", async () => {
            const playerInfo = { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" };
            await addStrike({ guildId: GUILD_ID, playerInfo, strike: makeStrike({ reason: "First offense" }) });
            await addStrike({ guildId: GUILD_ID, playerInfo, strike: makeStrike({ reason: "Second offense" }) });
            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(record);
            assert.strictEqual(record.strikes.length, 2);
        });

        it("refreshes guildId and guildName when player switches guilds", async () => {
            const originalInfo = { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "old-guild-id", guildName: "Old Guild" };
            await addStrike({ guildId: GUILD_ID, playerInfo: originalInfo, strike: makeStrike() });

            const updatedInfo = { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "new-guild-id", guildName: "New Guild" };
            await addStrike({ guildId: GUILD_ID, playerInfo: updatedInfo, strike: makeStrike() });

            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(record);
            assert.strictEqual(record.guildId, "new-guild-id");
            assert.strictEqual(record.guildName, "New Guild");
            assert.strictEqual(record.strikes.length, 2);
        });
    });

    describe("revokeStrike", () => {
        it("returns 'no_player' when player has no record", async () => {
            const result = await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "nonexistent", revokedBy: "officer-id" });
            assert.strictEqual(result, "no_player");
        });

        it("returns 'not_found' when strikeId does not match any strike", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike({ id: "known-id" }),
            });
            const result = await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "wrong-id", revokedBy: "officer-id" });
            assert.strictEqual(result, "not_found");
        });

        it("returns 'already_revoked' when strike was previously revoked", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike({ id: "rev-id" }),
            });
            await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "rev-id", revokedBy: "officer-id" });
            const result = await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "rev-id", revokedBy: "officer-id" });
            assert.strictEqual(result, "already_revoked");
        });

        it("marks an expired strike as revoked and returns 'revoked'", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike({ id: "exp-id", expiresAt: Date.now() - 1000 }),
            });
            const result = await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "exp-id", revokedBy: "officer-id" });
            assert.strictEqual(result, "revoked");
            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(record);
            assert.strictEqual(record.strikes.length, 1, "Strike record should be retained");
            assert.ok(record.strikes[0].removedAt, "removedAt should be set");
            assert.strictEqual(record.strikes[0].removedBy, "officer-id");
        });

        it("marks an active strike as revoked and returns 'revoked'", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike({ id: "active-id" }),
            });
            const result = await revokeStrike({ guildId: GUILD_ID, allyCode: ALLY_CODE, strikeId: "active-id", revokedBy: "officer-id" });
            assert.strictEqual(result, "revoked");
            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.ok(record);
            assert.strictEqual(record.strikes.length, 1, "Strike record should be retained");
            assert.ok(record.strikes[0].removedAt, "removedAt should be set");
            assert.strictEqual(getActiveStrikes(record.strikes).length, 0, "Revoked strike should not appear as active");
        });
    });

    describe("clearStrikes", () => {
        it("returns false when player has no record", async () => {
            const result = await clearStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.strictEqual(result, false);
        });

        it("removes entire player entry and returns true", async () => {
            await addStrike({
                guildId: GUILD_ID,
                playerInfo: { allyCode: ALLY_CODE, playerName: "TestPlayer", guildId: "g1", guildName: "Guild1" },
                strike: makeStrike(),
            });
            const result = await clearStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.strictEqual(result, true);
            const record = await getPlayerStrikes({ guildId: GUILD_ID, allyCode: ALLY_CODE });
            assert.strictEqual(record, null);
        });
    });
});
