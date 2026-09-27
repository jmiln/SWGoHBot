import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Guild } from "discord.js";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import guildDelete from "../../events/guildDelete.ts";
import cache from "../../modules/cache.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("guildDelete event", () => {
    let client: MongoClient;
    const db = () => client.db(env.MONGODB_SWGOHBOT_DB);

    // Distinctive IDs scoped to this suite - the shared test DB runs suites in parallel
    const LEFT_GUILD = "884000000000000001";
    const OTHER_GUILD = "884000000000000002";
    const PATRON_OF_LEFT = "885000000000000001";
    const SECOND_PATRON_OF_LEFT = "885000000000000002";
    const PATRON_OF_OTHER = "885000000000000003";
    const USER_IDS = [PATRON_OF_LEFT, SECOND_PATRON_OF_LEFT, PATRON_OF_OTHER];

    const fakeGuild = (available: boolean) => ({ id: LEFT_GUILD, name: "Left Guild", available }) as unknown as Guild;

    async function bonusServerOf(userId: string) {
        return (await db().collection("users").findOne({ id: userId }))?.bonusServer;
    }

    async function cleanup() {
        await db()
            .collection("guildConfigs")
            .deleteMany({ guildId: { $in: [LEFT_GUILD, OTHER_GUILD] } });
        await db()
            .collection("users")
            .deleteMany({ id: { $in: USER_IDS } });
    }

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
    });

    beforeEach(async () => {
        await cleanup();
        await db()
            .collection("users")
            .insertMany([
                { id: PATRON_OF_LEFT, accounts: [], bonusServer: LEFT_GUILD },
                { id: SECOND_PATRON_OF_LEFT, accounts: [], bonusServer: LEFT_GUILD },
                { id: PATRON_OF_OTHER, accounts: [], bonusServer: OTHER_GUILD },
            ]);
        await db()
            .collection("guildConfigs")
            .insertOne({ guildId: LEFT_GUILD, patreonSettings: { supporters: [{ userId: PATRON_OF_LEFT, tier: 5 }] } });
    });

    after(async () => {
        await cleanup();
        await closeMongoClient();
    });

    it("clears the bonus server of every patron who pointed it at the server the bot left", async () => {
        await guildDelete.execute(fakeGuild(true));

        assert.strictEqual(await bonusServerOf(PATRON_OF_LEFT), null);
        assert.strictEqual(await bonusServerOf(SECOND_PATRON_OF_LEFT), null);
        assert.strictEqual(await bonusServerOf(PATRON_OF_OTHER), OTHER_GUILD, "Another server's patron must be untouched");
        assert.strictEqual(await db().collection("guildConfigs").findOne({ guildId: LEFT_GUILD }), null, "Expected the config deleted");
    });

    it("changes nothing when the server is only unavailable (a Discord outage)", async () => {
        await guildDelete.execute(fakeGuild(false));

        assert.strictEqual(await bonusServerOf(PATRON_OF_LEFT), LEFT_GUILD);
        assert.ok(await db().collection("guildConfigs").findOne({ guildId: LEFT_GUILD }), "Expected the config kept");
    });
});
