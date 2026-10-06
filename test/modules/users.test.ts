import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import type { UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const testDbName = env.MONGODB_SWGOHBOT_DB;

const makeUserConfig = (id: string, allyCode: number, primary = true): UserConfig =>
    ({
        id,
        accounts: [allyCode],
        primaryAllyCode: primary ? allyCode : null,
        arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
        lang: { language: null, swgohLanguage: null },
    }) as unknown as UserConfig;

describe("UserReg Module", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    // All ids in this file use the "user-" prefix - scope cleanup to it so concurrent
    // test files' documents are never wiped mid-run
    const USERS_TEST_FILTER = { id: { $regex: "^user-" } };

    after(async () => {
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany(USERS_TEST_FILTER);
        } catch (_) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(async () => {
        try {
            await (await getMongoClient()).db(testDbName).collection("users").deleteMany(USERS_TEST_FILTER);
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
            const config = makeUserConfig("user-get-1", 123456789);
            await userReg.updateUser("user-get-1", config);

            const result = await userReg.getUser("user-get-1");
            assert.ok(result, "Expected a user document");
            assert.strictEqual(result.id, "user-get-1");
        });
    });

    describe("getUsersFromAlly()", () => {
        it("returns null when no user has the given ally code", async () => {
            const result = await userReg.getUsersFromAlly(100000000);
            assert.strictEqual(result, null);
        });

        it("returns an array containing the user when ally code is linked", async () => {
            const config = makeUserConfig("user-ally-1", 111222333);
            await userReg.updateUser("user-ally-1", config);

            const result = await userReg.getUsersFromAlly(111222333);
            assert.ok(Array.isArray(result) && result.length > 0, "Expected an array with at least one user");
            assert.strictEqual(result[0].id, "user-ally-1");
        });

        it("accepts a numeric ally code and still finds the user", async () => {
            const config = makeUserConfig("user-ally-2", 444555666);
            await userReg.updateUser("user-ally-2", config);

            const result = await userReg.getUsersFromAlly(444555666);
            assert.ok(Array.isArray(result) && result.length > 0, "Expected to find user by numeric ally code");
            assert.strictEqual(result[0].id, "user-ally-2");
        });
    });

    describe("updateUser()", () => {
        it("creates a new user with correct id", async () => {
            const config = makeUserConfig("user-update-1", 777888999);
            const result = await userReg.updateUser("user-update-1", config);
            assert.ok(result, "Expected a returned user document");
            assert.strictEqual(result.id, "user-update-1");
        });

        it("overwrites an existing user and the change persists", async () => {
            const original = makeUserConfig("user-update-2", 111111111);
            await userReg.updateUser("user-update-2", original);

            const updated = makeUserConfig("user-update-2", 222222222);
            await userReg.updateUser("user-update-2", updated);

            const fetched = await userReg.getUser("user-update-2");
            assert.ok(fetched, "Expected user to exist after update");
            assert.strictEqual(fetched.accounts[0], 222222222);
        });
    });

    describe("updateUser() on a loaded copy", () => {
        const makeWatchingUser = (id: string) =>
            ({
                ...makeUserConfig(id, 111111111),
                arenaAlert: {
                    enableRankDMs: "all",
                    arena: "both",
                    payoutWarning: 30,
                    enablePayoutResult: false,
                    alerted: { "111111111": { charWarn: 1 } },
                },
                arenaWatch: {
                    enabled: true,
                    report: "both",
                    allyCodes: [
                        { allyCode: 111111111, mention: null, poOffset: 0, mark: "A" },
                        { allyCode: 222222222, mention: null, poOffset: 0, mark: "B" },
                    ],
                    payout: { char: { enabled: true, channel: "chan", msgID: "payout-old" } },
                },
            }) as unknown as UserConfig;
        const savedUser = async (id: string) => {
            const saved = await userReg.getUser(id);
            assert.ok(saved, `Expected ${id} to exist`);
            return saved;
        };

        it("stamps only updatedAt when saving a change", async () => {
            await userReg.updateUser("user-stamp-1", makeUserConfig("user-stamp-1", 111111111));
            const loaded = await savedUser("user-stamp-1");
            loaded.accounts.push(222222222);

            await userReg.updateUser("user-stamp-1", loaded);

            const stored = await (await getMongoClient()).db(testDbName).collection("users").findOne({ id: "user-stamp-1" });
            assert.deepStrictEqual(stored?.accounts, [111111111, 222222222], "Expected the change saved");
            assert.ok(stored?.updatedAt instanceof Date, `Expected updatedAt to be a Date, got ${stored?.updatedAt}`);
            assert.ok(!("updated" in (stored ?? {})), `Expected no legacy updated field, found ${stored?.updated}`);
        });

        it("keeps fields another writer changed after the copy was loaded", async () => {
            await userReg.updateUser("user-diff-1", makeWatchingUser("user-diff-1"));
            const copy = await savedUser("user-diff-1");

            await userReg.updateUserFields("user-diff-1", {
                "arenaWatch.payout.char.msgID": "payout-new",
                "arenaAlert.alerted.222222222.fleetWarn": 7,
                "arenaWatch.allyCodes.1.poOffset": 120,
            });
            copy.lang.language = "de_DE";
            copy.arenaWatch.allyCodes[0].mark = "C";
            await userReg.updateUser("user-diff-1", copy);

            const saved = await savedUser("user-diff-1");
            assert.strictEqual(saved.lang.language, "de_DE", "the copy's own edit is saved");
            assert.strictEqual(saved.arenaWatch.allyCodes[0].mark, "C", "the copy's edit inside a watched account is saved");
            assert.strictEqual(saved.arenaWatch.payout.char.msgID, "payout-new", "another writer's msgID survives");
            assert.deepStrictEqual(saved.arenaAlert.alerted?.["222222222"], { fleetWarn: 7 }, "another writer's marker survives");
            assert.strictEqual(saved.arenaWatch.allyCodes[1].poOffset, 120, "another writer's edit to a sibling account survives");
        });

        it("keeps tracking a copy across repeated saves", async () => {
            await userReg.updateUser("user-diff-2", makeWatchingUser("user-diff-2"));
            const copy = await savedUser("user-diff-2");

            copy.lang.language = "de_DE";
            await userReg.updateUser("user-diff-2", copy);
            await userReg.updateUserFields("user-diff-2", { "arenaWatch.payout.char.msgID": "payout-new" });
            copy.primaryAllyCode = 222222222;
            await userReg.updateUser("user-diff-2", copy);

            const saved = await savedUser("user-diff-2");
            assert.strictEqual(saved.primaryAllyCode, 222222222);
            assert.strictEqual(saved.arenaWatch.payout.char.msgID, "payout-new", "the second save must not resend the first save's state");
        });

        it("writes an account edit to that account even after the list shifted underneath", async () => {
            await userReg.updateUser("user-diff-3", makeWatchingUser("user-diff-3"));
            const copy = await savedUser("user-diff-3");

            const other = await savedUser("user-diff-3");
            other.arenaWatch.allyCodes = other.arenaWatch.allyCodes.filter((a) => a.allyCode !== 111111111);
            await userReg.updateUser("user-diff-3", other);

            const kept = copy.arenaWatch.allyCodes[1];
            kept.alerted = { charWarn: 5 };
            await userReg.updateUser("user-diff-3", copy);

            const saved = await savedUser("user-diff-3");
            assert.deepStrictEqual(
                saved.arenaWatch.allyCodes.map((a) => [a.allyCode, a.alerted]),
                [[222222222, { charWarn: 5 }]],
                "the removed account must stay removed, and the edit must land on 222222222",
            );
        });

        it("removes fields the copy deleted, and saves added or removed accounts", async () => {
            await userReg.updateUser("user-diff-4", makeWatchingUser("user-diff-4"));
            const copy = await savedUser("user-diff-4");

            delete copy.arenaAlert.alerted?.["111111111"];
            copy.arenaWatch.allyCodes.push({ allyCode: 333333333, mention: null, poOffset: 0 });
            await userReg.updateUser("user-diff-4", copy);

            const saved = await savedUser("user-diff-4");
            assert.deepStrictEqual(saved.arenaAlert.alerted, {}, "the deleted marker is removed");
            assert.deepStrictEqual(
                saved.arenaWatch.allyCodes.map((a) => a.allyCode),
                [111111111, 222222222, 333333333],
            );
        });

        it("tracks copies loaded in bulk", async () => {
            await userReg.updateUser("user-diff-5", makeWatchingUser("user-diff-5"));
            const copy = (await userReg.getUsersByIds(["user-diff-5"])).get("user-diff-5");
            assert.ok(copy);

            await userReg.updateUserFields("user-diff-5", { "arenaWatch.payout.char.msgID": "payout-new" });
            copy.arenaAlert.payoutWarning = 15;
            await userReg.updateUser("user-diff-5", copy);

            const saved = await savedUser("user-diff-5");
            assert.strictEqual(saved.arenaAlert.payoutWarning, 15);
            assert.strictEqual(saved.arenaWatch.payout.char.msgID, "payout-new");
        });
    });

    describe("updateUserFields()", () => {
        it("writes only the named paths, leaving the rest of the document alone", async () => {
            const config = makeUserConfig("user-fields-1", 555444333);
            await userReg.updateUser("user-fields-1", config);

            await userReg.updateUserFields("user-fields-1", { "arenaAlert.payoutWarning": 15 });

            const fetched = await userReg.getUser("user-fields-1");
            assert.ok(fetched, "Expected user to exist");
            assert.strictEqual(fetched.arenaAlert.payoutWarning, 15, "the named path is written");
            assert.strictEqual(fetched.arenaAlert.arena, "none", "sibling fields are untouched");
            assert.deepStrictEqual(fetched.accounts, [555444333], "unrelated top-level fields are untouched");
        });

        it("does not create a document when the user is gone", async () => {
            // Upserting a since-deregistered user would build a document from the filter plus the
            // dotted paths, and nothing validates on read, so it sits malformed rather than failing.
            await userReg.updateUserFields("user-fields-missing", { "arenaWatch.payout.char.msgID": "msg-1" });

            const fetched = await userReg.getUser("user-fields-missing");
            assert.strictEqual(fetched, null, "a targeted field write must not resurrect a deleted user");
        });
    });

    describe("removeAllyCode()", () => {
        it("removes the specified ally code from the user", async () => {
            const config = makeUserConfig("user-rem-ac-1", 321654987);
            await userReg.updateUser("user-rem-ac-1", config);

            await userReg.removeAllyCode("user-rem-ac-1", 321654987);

            const fetched = await userReg.getUser("user-rem-ac-1");
            assert.ok(fetched, "User should still exist");
            assert.strictEqual(fetched.accounts.length, 0, "Account should have been removed");
        });

        it("throws when the user is not found", async () => {
            await assert.rejects(async () => await userReg.removeAllyCode("nonexistent-user", 123456789), /Could not find specified user/);
        });

        it("throws when the ally code is not linked to the user", async () => {
            const config = makeUserConfig("user-rem-ac-2", 111111111);
            await userReg.updateUser("user-rem-ac-2", config);

            await assert.rejects(async () => await userReg.removeAllyCode("user-rem-ac-2", 999999999), /Specified ally code not linked/);
        });

        it("leaves other ally codes intact when removing one", async () => {
            const config: UserConfig = {
                id: "user-rem-ac-3",
                accounts: [111111111, 222222222],
                primaryAllyCode: 111111111,
                arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
                lang: { language: null, swgohLanguage: null },
            } as unknown as UserConfig;
            await userReg.updateUser("user-rem-ac-3", config);

            await userReg.removeAllyCode("user-rem-ac-3", 111111111);

            const fetched = await userReg.getUser("user-rem-ac-3");
            assert.ok(fetched, "Expected user to still exist");
            assert.strictEqual(fetched.accounts.length, 1, "Should still have 1 account");
            assert.strictEqual(fetched.accounts[0], 222222222, "Remaining account should be 222222222");
        });

        it("drops the account's payout alert markers so a relink starts clean", async () => {
            // arenaAlert.alerted records the cycle each DM alert last fired for, so a marker left
            // behind by an unlink suppresses that cycle's alert if the code is relinked inside it.
            const config: UserConfig = {
                id: "user-rem-ac-5",
                accounts: [111111111, 222222222],
                primaryAllyCode: 111111111,
                arenaAlert: {
                    enableRankDMs: "off",
                    arena: "none",
                    payoutWarning: 0,
                    enablePayoutResult: false,
                    alerted: {
                        "111111111": { charWarn: 1234, charResult: 5678 },
                        "222222222": { fleetWarn: 4321 },
                    },
                },
                lang: { language: null, swgohLanguage: null },
            } as unknown as UserConfig;
            await userReg.updateUser("user-rem-ac-5", config);

            await userReg.removeAllyCode("user-rem-ac-5", 111111111);

            const fetched = await userReg.getUser("user-rem-ac-5");
            assert.ok(fetched, "Expected user to still exist");
            assert.strictEqual(fetched.arenaAlert.alerted?.["111111111"], undefined, "the removed code's markers must be dropped");
            assert.deepStrictEqual(
                fetched.arenaAlert.alerted?.["222222222"],
                { fleetWarn: 4321 },
                "a still-linked account's markers must be left alone",
            );
        });

        it("updates primaryAllyCode when the primary account is removed", async () => {
            const config: UserConfig = {
                id: "user-rem-ac-4",
                accounts: [111111111, 222222222],
                primaryAllyCode: 111111111,
                arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
                lang: { language: null, swgohLanguage: null },
            } as unknown as UserConfig;
            await userReg.updateUser("user-rem-ac-4", config);

            await userReg.removeAllyCode("user-rem-ac-4", 111111111);

            const fetched = await userReg.getUser("user-rem-ac-4");
            assert.ok(fetched, "User should still exist");
            assert.strictEqual(fetched.primaryAllyCode, 222222222, "primaryAllyCode should move to remaining account");
        });
    });

    describe("removeUser()", () => {
        it("returns true and removes the user from the DB", async () => {
            const config = makeUserConfig("user-del-1", 999888777);
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
