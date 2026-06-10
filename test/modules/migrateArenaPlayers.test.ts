import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import { ArenaWatchConfigSchema } from "../../schemas/users.schema.ts";
import { oldFormatUserFilter, runMigration } from "../../scripts/migrateArenaPlayers.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("migrateArenaPlayers", () => {
    let client: MongoClient;
    const db = env.MONGODB_SWGOHBOT_DB;

    const TEST_USER_IDS = ["mig_user_old", "mig_user_awonly", "mig_user_new"];
    const TEST_ALLY_CODES = [474747471, 474747472, 474747473];

    before(async () => {
        client = await getMongoClient();
    });

    after(async () => {
        await client.db(db).collection("users").deleteMany({ id: { $in: TEST_USER_IDS } });
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: TEST_ALLY_CODES } });
        await closeMongoClient();
    });

    beforeEach(async () => {
        await client.db(db).collection("users").deleteMany({ id: { $in: TEST_USER_IDS } });
        await client.db(db).collection("arenaPlayers").deleteMany({ allyCode: { $in: TEST_ALLY_CODES } });
    });

    describe("oldFormatUserFilter", () => {
        it("matches users with old-format object accounts", async () => {
            await client.db(db).collection("users").insertOne({
                id: "mig_user_old",
                accounts: [{ allyCode: 474747471, name: "OldFmt", primary: true }],
            });
            const matches = await client.db(db).collection("users").find(oldFormatUserFilter).toArray();
            assert.ok(matches.some((d) => d.id === "mig_user_old"));
        });

        it("matches arenaWatch-only users with old-format watch entries and no object accounts", async () => {
            await client.db(db).collection("users").insertOne({
                id: "mig_user_awonly",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 474747472, name: "WatchOnly", lastChar: 12, poOffset: 0, mention: null }],
                },
            });
            const matches = await client.db(db).collection("users").find(oldFormatUserFilter).toArray();
            assert.ok(
                matches.some((d) => d.id === "mig_user_awonly"),
                "arenaWatch-only users must be migrated too",
            );
        });

        it("matches users with mixed accounts where the first entry is already flat", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_old",
                    accounts: [474747473, { allyCode: 474747471, name: "MixedFmt", primary: true }],
                });
            const matches = await client.db(db).collection("users").find(oldFormatUserFilter).toArray();
            assert.ok(
                matches.some((d) => d.id === "mig_user_old"),
                "mixed accounts arrays must still be migrated",
            );
        });

        it("does not match new-format users", async () => {
            await client.db(db).collection("users").insertOne({
                id: "mig_user_new",
                accounts: [474747473],
                primaryAllyCode: 474747473,
                arenaWatch: { allyCodes: [{ allyCode: 474747473, mention: null, poOffset: 60 }] },
            });
            const matches = await client.db(db).collection("users").find(oldFormatUserFilter).toArray();
            assert.ok(!matches.some((d) => d.id === "mig_user_new"));
        });
    });

    describe("runMigration()", () => {
        it("flattens object accounts, sets primaryAllyCode, and creates arenaPlayers docs", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_old",
                    accounts: [
                        { allyCode: 474747471, name: "Primary", primary: false, lastCharRank: 3, charHist: [{ rank: 3, ts: 1000 }] },
                        { allyCode: 474747473, name: "Alt", primary: true },
                    ],
                });

            await runMigration(client);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_old" });
            assert.deepStrictEqual(user?.accounts, [474747471, 474747473]);
            assert.strictEqual(user?.primaryAllyCode, 474747473);

            const playerDoc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 474747471 });
            assert.strictEqual(playerDoc?.name, "Primary");
            assert.strictEqual(playerDoc?.lastCharRank, 3);
            assert.deepStrictEqual(playerDoc?.charHist, [{ rank: 3, ts: 1000 }]);
        });

        it("migrates arenaWatch-only users: creates arenaPlayers docs and cleans watch entries", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_awonly",
                    accounts: [474747473],
                    primaryAllyCode: 474747473,
                    arenaWatch: {
                        allyCodes: [
                            {
                                allyCode: 474747472,
                                name: "WatchOnly",
                                lastChar: 12,
                                lastShip: 7,
                                charHist: [{ rank: 12, ts: 1000 }],
                                poOffset: 0,
                                mention: null,
                            },
                        ],
                    },
                });

            await runMigration(client);

            const playerDoc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 474747472 });
            assert.ok(playerDoc, "arenaWatch-only player data must be migrated to arenaPlayers");
            assert.strictEqual(playerDoc.name, "WatchOnly");
            assert.strictEqual(playerDoc.lastCharRank, 12);
            assert.strictEqual(playerDoc.lastShipRank, 7);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_awonly" });
            const entry = user?.arenaWatch?.allyCodes?.[0];
            assert.strictEqual(entry?.name, undefined, "player-data fields must be stripped from watch entries");
            assert.strictEqual(entry?.lastChar, undefined);
            // Already-flat accounts must survive the migration untouched
            assert.deepStrictEqual(user?.accounts, [474747473]);
            assert.strictEqual(user?.primaryAllyCode, 474747473);
        });

        it("produces watch entries that satisfy ArenaWatchConfigSchema", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_awonly",
                    accounts: [],
                    arenaWatch: {
                        allyCodes: [
                            // mention: null gets omitted by the migration; the schema must accept that
                            { allyCode: 474747471, name: "NullMention", lastChar: 3, mention: null, poOffset: 60 },
                            // a defensive case: poOffset absent entirely
                            { allyCode: 474747472, name: "NoOffset", mention: "12345" },
                        ],
                    },
                });

            await runMigration(client);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_awonly" });
            for (const entry of user?.arenaWatch?.allyCodes ?? []) {
                const result = ArenaWatchConfigSchema.safeParse(entry);
                assert.ok(result.success, `migrated entry must satisfy the schema: ${JSON.stringify(entry)} -> ${result.error}`);
            }
        });

        it("drops entries with nullish allyCodes instead of coercing them to 0", async () => {
            // Number(null) === 0, so a plain NaN check lets these through as allyCode 0
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_old",
                    accounts: [
                        { allyCode: null, name: "Ghost" },
                        { allyCode: 474747471, name: "Real", primary: true },
                    ],
                });

            await runMigration(client);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_old" });
            assert.deepStrictEqual(user?.accounts, [474747471], "nullish allyCodes must be dropped, not kept as 0");
            assert.strictEqual(user?.primaryAllyCode, 474747471);

            const zeroDoc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 0 });
            assert.strictEqual(zeroDoc, null, "no arenaPlayers doc may be created with allyCode 0");
        });

        it("normalizes legacy string allyCodes in watch entries to numbers", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_awonly",
                    accounts: [],
                    arenaWatch: {
                        allyCodes: [{ allyCode: "474747472", name: "StringCode", lastChar: 5, poOffset: 60, mention: null }],
                    },
                });

            await runMigration(client);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_awonly" });
            const entry = user?.arenaWatch?.allyCodes?.[0];
            assert.strictEqual(entry?.allyCode, 474747472, "watch entry allyCode must be stored as a number");

            // The arenaPlayers doc keys on the numeric code, so the entry must match it
            const playerDoc = await client.db(db).collection("arenaPlayers").findOne({ allyCode: 474747472 });
            assert.strictEqual(playerDoc?.name, "StringCode");
        });

        it("omits poOffset from cleaned watch entries when the old entry had none", async () => {
            await client
                .db(db)
                .collection("users")
                .insertOne({
                    id: "mig_user_awonly",
                    accounts: [],
                    arenaWatch: {
                        allyCodes: [{ allyCode: 474747472, name: "NoOffset", mention: null }],
                    },
                });

            await runMigration(client);

            const user = await client.db(db).collection("users").findOne({ id: "mig_user_awonly" });
            const entry = user?.arenaWatch?.allyCodes?.[0];
            assert.ok(entry);
            assert.ok(!("poOffset" in entry) || entry.poOffset != null, "a missing poOffset must not be written as null");
        });
    });
});
