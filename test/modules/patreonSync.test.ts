import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { RESTJSONErrorCodes as APIErrors, DiscordAPIError, Routes } from "discord.js";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import { clearDepartedBonusServers } from "../../modules/patreonSync.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("patreonSync", () => {
    let client: MongoClient;
    const db = () => client.db(env.MONGODB_SWGOHBOT_DB);

    // Distinctive IDs scoped to this suite - the shared test DB runs suites in parallel. A fresh
    // guild per test, since other suites' ensureGuildSupporter can write back a stale supporters list.
    const usedGuilds: string[] = [];
    let GUILD = "";
    const USER_LEFT = "883000000000000001";
    const USER_STAYED = "883000000000000002";
    const USER_NO_ACCESS = "883000000000000003";
    const USER_NETWORK = "883000000000000004";
    const USER_NO_BONUS = "883000000000000005";
    const USER_IDS = [USER_LEFT, USER_STAYED, USER_NO_ACCESS, USER_NETWORK, USER_NO_BONUS];
    const BONUS_USERS = [USER_LEFT, USER_STAYED, USER_NO_ACCESS, USER_NETWORK];

    function apiError(code: APIErrors, status: number, message: string, route: string) {
        return new DiscordAPIError({ code, message }, code, status, "GET", route, {});
    }

    // Routes this suite did not seed belong to other suites' users, so answer them as current members
    function fakeRest(failures: Record<string, Error>) {
        const calls: string[] = [];
        const rest = {
            get: async (route: string) => {
                calls.push(route);
                const failure = failures[route];
                if (failure) throw failure;
                return {};
            },
        };
        return { rest, calls };
    }

    async function bonusServerOf(userId: string) {
        return (await db().collection("users").findOne({ id: userId }))?.bonusServer;
    }

    async function supporterIds() {
        const guild = await db().collection("guildConfigs").findOne({ guildId: GUILD });
        return (guild?.patreonSettings?.supporters ?? []).map((s: { userId: string }) => s.userId).sort();
    }

    async function cleanup() {
        await db()
            .collection("guildConfigs")
            .deleteMany({ guildId: { $in: usedGuilds } });
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
        GUILD = `88200000000000${String(usedGuilds.length + 1).padStart(4, "0")}`;
        usedGuilds.push(GUILD);
        await db()
            .collection("users")
            .insertMany([
                ...BONUS_USERS.map((id) => ({ id, accounts: [], bonusServer: GUILD })),
                { id: USER_NO_BONUS, accounts: [], bonusServer: null },
            ]);
        await db()
            .collection("guildConfigs")
            .insertOne({ guildId: GUILD, patreonSettings: { supporters: BONUS_USERS.map((userId) => ({ userId, tier: 5 })) } });
    });

    after(async () => {
        await cleanup();
        await closeMongoClient();
    });

    describe("clearDepartedBonusServers()", () => {
        it("clears the bonus server of a patron who has left that server", async () => {
            const route = Routes.guildMember(GUILD, USER_LEFT);
            const { rest } = fakeRest({ [route]: apiError(APIErrors.UnknownMember, 404, "Unknown Member", route) });

            await clearDepartedBonusServers(rest);

            assert.strictEqual(await bonusServerOf(USER_LEFT), null, "Expected the departed patron's bonusServer cleared");
            assert.deepStrictEqual(await supporterIds(), [USER_STAYED, USER_NO_ACCESS, USER_NETWORK].sort());
        });

        it("keeps the bonus server of a patron still in that server", async () => {
            const { rest, calls } = fakeRest({});

            await clearDepartedBonusServers(rest);

            assert.ok(calls.includes(Routes.guildMember(GUILD, USER_STAYED)), `Expected a lookup for ${USER_STAYED}, got ${calls}`);
            assert.strictEqual(await bonusServerOf(USER_STAYED), GUILD);
            assert.deepStrictEqual(await supporterIds(), [...BONUS_USERS].sort());
        });

        it("keeps the bonus server when the lookup fails for any other reason", async () => {
            const noAccessRoute = Routes.guildMember(GUILD, USER_NO_ACCESS);
            const { rest } = fakeRest({
                [noAccessRoute]: apiError(APIErrors.MissingAccess, 403, "Missing Access", noAccessRoute),
                [Routes.guildMember(GUILD, USER_NETWORK)]: new Error("socket hang up"),
            });

            await clearDepartedBonusServers(rest);

            assert.strictEqual(await bonusServerOf(USER_NO_ACCESS), GUILD, "A permissions error is not proof the patron left");
            assert.strictEqual(await bonusServerOf(USER_NETWORK), GUILD, "A transient failure is not proof the patron left");
            assert.deepStrictEqual(await supporterIds(), [...BONUS_USERS].sort());
        });

        it("does not look up users without a bonus server", async () => {
            const { rest, calls } = fakeRest({});

            await clearDepartedBonusServers(rest);

            assert.ok(!calls.some((route) => route.endsWith(USER_NO_BONUS)), `Unexpected lookup for ${USER_NO_BONUS}: ${calls}`);
        });
    });
});
