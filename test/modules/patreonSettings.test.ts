import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import {
    addServerSupporter,
    ensureBonusServerSet,
    ensureGuildSupporter,
    removeServerSupporter,
} from "../../modules/guildConfig/patreonSettings.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("guildConfig/patreonSettings", () => {
    let client: MongoClient;
    const testDbName = env.MONGODB_SWGOHBOT_DB;

    // Distinctive IDs scoped to this suite — the shared test DB runs suites in parallel
    const GUILD_ONE = "880000000000000001";
    const GUILD_TWO = "880000000000000002";
    const USER_ONE = "881000000000000001";
    const USER_TWO = "881000000000000002";

    async function cleanup() {
        await client
            .db(testDbName)
            .collection("guildConfigs")
            .deleteMany({ guildId: { $in: [GUILD_ONE, GUILD_TWO] } });
        await client
            .db(testDbName)
            .collection("users")
            .deleteMany({ id: { $in: [USER_ONE, USER_TWO] } });
    }

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
    });

    after(async () => {
        try {
            await cleanup();
        } catch (_e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    beforeEach(async () => {
        await cleanup().catch(() => {});
    });

    describe("ensureGuildSupporter()", () => {
        it("removes stale supporters from every guild, not just the first modified one", async () => {
            // Both users have moved their bonusServer away from the guilds that still list them
            await client
                .db(testDbName)
                .collection("users")
                .insertMany([
                    { id: USER_ONE, bonusServer: null },
                    { id: USER_TWO, bonusServer: "999999999999999999" },
                ]);
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertMany([
                    { guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 1 }] } },
                    { guildId: GUILD_TWO, patreonSettings: { supporters: [{ userId: USER_TWO, tier: 5 }] } },
                ]);

            await ensureGuildSupporter();

            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            const guildTwo = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_TWO });
            assert.deepStrictEqual(guildOne?.patreonSettings?.supporters, [], "Expected first guild's stale supporter removed");
            assert.deepStrictEqual(guildTwo?.patreonSettings?.supporters, [], "Expected second guild's stale supporter removed");
        });

        it("keeps supporters whose bonusServer still points at the guild", async () => {
            await client.db(testDbName).collection("users").insertOne({ id: USER_ONE, bonusServer: GUILD_ONE });
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertOne({ guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 1 }] } });

            await ensureGuildSupporter();

            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            assert.deepStrictEqual(
                guildOne?.patreonSettings?.supporters,
                [{ userId: USER_ONE, tier: 1 }],
                "Expected valid supporter to remain",
            );
        });
    });

    describe("ensureBonusServerSet()", () => {
        it("refreshes the stored tier when the pledge amount has changed", async () => {
            // User pledged $1 when they linked, but now pays $5
            await client.db(testDbName).collection("users").insertOne({ id: USER_ONE, bonusServer: GUILD_ONE });
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertOne({ guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 1 }] } });

            await ensureBonusServerSet({ userId: USER_ONE, amount_cents: 500 });

            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            assert.deepStrictEqual(
                guildOne?.patreonSettings?.supporters,
                [{ userId: USER_ONE, tier: 5 }],
                "Expected stored tier updated to match the current pledge",
            );
        });

        it("leaves the supporters array untouched when the tier already matches", async () => {
            await client.db(testDbName).collection("users").insertOne({ id: USER_ONE, bonusServer: GUILD_ONE });
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertOne({ guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 5 }] } });

            await ensureBonusServerSet({ userId: USER_ONE, amount_cents: 500 });

            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            assert.deepStrictEqual(
                guildOne?.patreonSettings?.supporters,
                [{ userId: USER_ONE, tier: 5 }],
                "Expected supporters array unchanged",
            );
        });
    });

    describe("addServerSupporter()", () => {
        it("removes the old guild's entry when moving the bonus server to a new guild", async () => {
            // User currently supports GUILD_ONE, then runs /patreon set_server in GUILD_TWO
            await client.db(testDbName).collection("users").insertOne({ id: USER_ONE, bonusServer: GUILD_ONE });
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertMany([
                    { guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 5 }] } },
                    { guildId: GUILD_TWO, patreonSettings: { supporters: [] } },
                ]);

            const res = await addServerSupporter({ guildId: GUILD_TWO, userInfo: { userId: USER_ONE, tier: 5 } });

            assert.strictEqual(res.guild.success, true, `Expected guild update to succeed, got: ${res.guild.error}`);
            assert.strictEqual(res.user.success, true, `Expected user update to succeed, got: ${res.user.error}`);

            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            const guildTwo = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_TWO });
            const userConf = await client.db(testDbName).collection("users").findOne({ id: USER_ONE });
            assert.deepStrictEqual(guildOne?.patreonSettings?.supporters, [], "Expected old guild's entry removed");
            assert.deepStrictEqual(
                guildTwo?.patreonSettings?.supporters,
                [{ userId: USER_ONE, tier: 5 }],
                "Expected new guild's entry added",
            );
            assert.strictEqual(userConf?.bonusServer, GUILD_TWO, "Expected bonusServer moved to the new guild");
        });

        it("still rejects re-linking the same guild", async () => {
            await client.db(testDbName).collection("users").insertOne({ id: USER_ONE, bonusServer: GUILD_ONE });
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertOne({ guildId: GUILD_ONE, patreonSettings: { supporters: [{ userId: USER_ONE, tier: 5 }] } });

            const res = await addServerSupporter({ guildId: GUILD_ONE, userInfo: { userId: USER_ONE, tier: 5 } });

            assert.strictEqual(res.user.success, false, "Expected duplicate link to be rejected");
            assert.match(res.user.error ?? "", /already set/i, "Expected 'already set' error");
        });
    });

    describe("removeServerSupporter()", () => {
        it("removes the user and keeps patreonSettings at its normal nesting level", async () => {
            await client
                .db(testDbName)
                .collection("guildConfigs")
                .insertOne({
                    guildId: GUILD_ONE,
                    patreonSettings: {
                        supporters: [
                            { userId: USER_ONE, tier: 1 },
                            { userId: USER_TWO, tier: 5 },
                        ],
                    },
                });

            const res = await removeServerSupporter({ guildId: GUILD_ONE, userId: USER_ONE });

            assert.strictEqual(res.success, true, `Expected removal to succeed, got: ${res.error}`);
            const guildOne = await client.db(testDbName).collection("guildConfigs").findOne({ guildId: GUILD_ONE });
            assert.deepStrictEqual(
                guildOne?.patreonSettings?.supporters,
                [{ userId: USER_TWO, tier: 5 }],
                "Expected remaining supporter at patreonSettings.supporters, not double-nested",
            );
            assert.strictEqual(guildOne?.patreonSettings?.patreonSettings, undefined, "Expected no nested patreonSettings key");
        });
    });
});
