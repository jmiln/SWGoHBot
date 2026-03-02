import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import type { UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const testDbName = env.MONGODB_SWGOHBOT_DB;

const makeUserConfig = (id: string, allyCode: string, primary = true): UserConfig =>
    ({
        id,
        accounts: [{ allyCode, name: "TestPlayer", primary }],
        arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
        lang: { language: null, swgohLanguage: null },
    }) as unknown as UserConfig;

describe("UserReg Module", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany({});
        } catch (_) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(async () => {
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany({});
        } catch (_) {
            // Collection may not exist yet
        }
    });

    describe("getUser()", () => {
        it("returns null for an unknown user", async () => {
            const result = await userReg.getUser("unknown-id-999");
            assert.strictEqual(result, null);
        });

        it("returns the user document after inserting one", async () => {
            const config = makeUserConfig("user-get-1", "123456789");
            await userReg.updateUser("user-get-1", config);

            const result = await userReg.getUser("user-get-1");
            assert.ok(result, "Expected a user document");
            assert.strictEqual(result.id, "user-get-1");
        });
    });

    describe("getUsersFromAlly()", () => {
        it("returns null when no user has the given ally code", async () => {
            const result = await userReg.getUsersFromAlly("000000000");
            assert.strictEqual(result, null);
        });

        it("returns an array containing the user when ally code is linked", async () => {
            const config = makeUserConfig("user-ally-1", "111222333");
            await userReg.updateUser("user-ally-1", config);

            const result = await userReg.getUsersFromAlly("111222333");
            assert.ok(Array.isArray(result) && result.length > 0, "Expected an array with at least one user");
            assert.strictEqual(result[0].id, "user-ally-1");
        });

        it("accepts a numeric ally code and still finds the user", async () => {
            const config = makeUserConfig("user-ally-2", "444555666");
            await userReg.updateUser("user-ally-2", config);

            // Pass as a number — the module converts it to string internally
            const result = await userReg.getUsersFromAlly(444555666);
            assert.ok(Array.isArray(result) && result.length > 0, "Expected to find user by numeric ally code");
            assert.strictEqual(result[0].id, "user-ally-2");
        });
    });

    describe("updateUser()", () => {
        it("creates a new user with correct id", async () => {
            const config = makeUserConfig("user-update-1", "777888999");
            const result = await userReg.updateUser("user-update-1", config);
            assert.ok(result, "Expected a returned user document");
            assert.strictEqual(result.id, "user-update-1");
        });

        it("overwrites an existing user and the change persists", async () => {
            const original = makeUserConfig("user-update-2", "111111111");
            await userReg.updateUser("user-update-2", original);

            const updated = makeUserConfig("user-update-2", "222222222");
            await userReg.updateUser("user-update-2", updated);

            const fetched = await userReg.getUser("user-update-2");
            assert.ok(fetched, "Expected user to exist after update");
            assert.strictEqual(fetched.accounts[0].allyCode, "222222222");
        });
    });

    describe("removeAllyCode()", () => {
        it("removes the specified ally code from the user", async () => {
            const config = makeUserConfig("user-rem-ac-1", "321654987");
            await userReg.updateUser("user-rem-ac-1", config);

            await userReg.removeAllyCode("user-rem-ac-1", "321654987");

            const fetched = await userReg.getUser("user-rem-ac-1");
            assert.ok(fetched, "User should still exist");
            assert.strictEqual(fetched.accounts.length, 0, "Account should have been removed");
        });

        it("throws when the user is not found", async () => {
            await assert.rejects(
                async () => await userReg.removeAllyCode("nonexistent-user", "123456789"),
                /Could not find specified user/,
            );
        });

        it("throws when the ally code is not linked to the user", async () => {
            const config = makeUserConfig("user-rem-ac-2", "111111111");
            await userReg.updateUser("user-rem-ac-2", config);

            await assert.rejects(
                async () => await userReg.removeAllyCode("user-rem-ac-2", "999999999"),
                /Specified ally code not linked/,
            );
        });

        it("leaves other ally codes intact when removing one", async () => {
            const config: UserConfig = {
                id: "user-rem-ac-3",
                accounts: [
                    { allyCode: "111111111", name: "Acct1", primary: true },
                    { allyCode: "222222222", name: "Acct2", primary: false },
                ],
                arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
                lang: { language: null, swgohLanguage: null },
            } as unknown as UserConfig;
            await userReg.updateUser("user-rem-ac-3", config);

            await userReg.removeAllyCode("user-rem-ac-3", "111111111");

            const fetched = await userReg.getUser("user-rem-ac-3");
            assert.ok(fetched, "Expected user to still exist");
            assert.strictEqual(fetched.accounts.length, 1, "Should still have 1 account");
            assert.strictEqual(fetched.accounts[0].allyCode, "222222222", "Remaining account should be 222222222");
        });
    });

    describe("removeUser()", () => {
        it("returns true and removes the user from the DB", async () => {
            const config = makeUserConfig("user-del-1", "999888777");
            await userReg.updateUser("user-del-1", config);

            const result = await userReg.removeUser("user-del-1");
            assert.strictEqual(result, true, "Expected removeUser to return true");

            const fetched = await userReg.getUser("user-del-1");
            assert.strictEqual(fetched, null, "User should no longer exist");
        });

        it("returns false when the user does not exist", async () => {
            const result = await userReg.removeUser("totally-nonexistent-user");
            assert.strictEqual(result, false);
        });
    });
});
