import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { type Client } from "discord.js";
import { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import { PatreonFuncs, buildRankSnapshot, classifySendError, shouldWriteHistory, updateArenaHistory, collectAllyCodes, hydrateWatchAccounts, isInWarnWindow, payoutCycleInfo } from "../../modules/patreonFuncs.ts";
import userReg from "../../modules/users.ts";
import Language from "../../base/Language.ts";
import { defaultSettings } from "../../data/constants/defaultGuildConf.ts";
import constants from "../../data/constants/constants.ts";
import { createMockLanguage } from "../mocks/index.ts";
import type { ActivePatron, ArenaPlayer, ArenaWatchAcct, ArenaWatchConfig, PatronUser, PlayerArenaRes, UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

describe("PatreonFuncs Module", () => {
    let client: MongoClient;
    let patreonFuncs: PatreonFuncs;
    let mockClient: Client<true>;
    let sentDMs: { embeds?: { description?: string }[] }[];

    // This has to use the same database as name as the main bot, since that's what the patreonFuncs module uses
    const testDbName = env.MONGODB_SWGOHBOT_DB;

    before(async () => {
        // Get shared MongoDB client from testcontainer
        client = await getMongoClient();

        cache.init(client);
        userReg.init(cache);
        arenaPlayerRegistry.init(cache);

        sentDMs = [];
        // Create mock Discord client
        mockClient = {
            user: { id: "bot123", username: "TestBot" },
            guilds: { cache: new Map() },
            users: {
                fetch: async () => ({
                    send: async (msg: { embeds?: { description?: string }[] }) => {
                        sentDMs.push(msg);
                        return msg;
                    },
                }),
            },
        } as unknown as Client<true>;

        // handleArenaAlerts() formats payout time via the default registered language
        Language.registerLanguage(defaultSettings.language, createMockLanguage());

        patreonFuncs = new PatreonFuncs();
        patreonFuncs.init(mockClient);
    });

    after(async () => {
        try {
            await client.db(testDbName).collection("patrons").deleteMany({});
        } catch (e) {
            // Ignore cleanup errors
        }
        await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: { $in: [888777666] } });
        await closeMongoClient();
    });

    beforeEach(async () => {
        // Clear patrons collection before each test
        try {
            await client.db(testDbName).collection("patrons").deleteMany({});
        } catch (e) {
            // Collection might not exist yet
        }
        await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: { $in: [888777666] } }).catch(() => {});
    });

    describe("init()", () => {
        it("initializes with Discord client", () => {
            const newPatreonFuncs = new PatreonFuncs();
            newPatreonFuncs.init(mockClient);
            // If no error thrown, initialization successful
            assert.ok(true);
        });
    });

    describe("getPatronUser()", () => {
        it("returns patron from database", async () => {
            const patronData: PatronUser = {
                discordID: "123",
                amount_cents: 500, // $5 tier
                userId: "123",
            };

            await cache.put(testDbName, "patrons", { discordID: "123" }, patronData);

            const result = await patreonFuncs.getPatronUser("123");

            assert.ok(result);
            assert.strictEqual(result.discordID, "123");
            assert.strictEqual(result.amount_cents, 500);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });

        it("returns null for non-existent patron", async () => {
            const result = await patreonFuncs.getPatronUser("nonexistent");

            assert.strictEqual(result, null);
        });


        it("throws error for missing user ID", async () => {
            await assert.rejects(async () => await patreonFuncs.getPatronUser(""), /Missing user ID/);
        });

        it("returns correct tier benefits for $1 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier1",
                amount_cents: 100, // $1
                userId: "tier1",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier1");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });

        it("returns correct tier benefits for $5 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier5",
                amount_cents: 500, // $5
                userId: "tier5",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier5" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier5");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });

        it("returns correct tier benefits for $10 patron", async () => {
            const patronData: PatronUser = {
                discordID: "tier10",
                amount_cents: 1000, // $10
                userId: "tier10",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier10" }, patronData);

            const result = await patreonFuncs.getPatronUser("tier10");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
            assert.ok(result.awAccounts !== undefined);
        });
    });

    describe("getPlayerCooldown()", () => {
        it("returns default cooldowns for non-patron", async () => {
            const cooldown = await patreonFuncs.getPlayerCooldown("nonpatron");

            assert.ok(cooldown);
            assert.ok(typeof cooldown.player === "number");
            assert.ok(typeof cooldown.guild === "number");
            assert.ok(cooldown.player > 0);
            assert.ok(cooldown.guild > 0);
        });

        it("returns reduced cooldowns for patron", async () => {
            const patronData: PatronUser = {
                discordID: "cooldown_patron",
                amount_cents: 500, // $5
                userId: "cooldown_patron",
            };

            await cache.put(testDbName, "patrons", { discordID: "cooldown_patron" }, patronData);

            const defaultCooldown = await patreonFuncs.getPlayerCooldown("nonpatron");
            const patronCooldown = await patreonFuncs.getPlayerCooldown("cooldown_patron");

            // Patron should have better (lower) cooldowns
            assert.ok(patronCooldown.player <= defaultCooldown.player);
            assert.ok(patronCooldown.guild <= defaultCooldown.guild);
        });

        it("returns best cooldown between patron and guild supporter", async () => {
            const cooldown = await patreonFuncs.getPlayerCooldown("user123", "guild456");

            assert.ok(cooldown);
            assert.ok(typeof cooldown.player === "number");
            assert.ok(typeof cooldown.guild === "number");
        });

        it("handles higher tier patron correctly", async () => {
            const tier1Patron: PatronUser = {
                discordID: "tier1_cooldown",
                amount_cents: 100, // $1
                userId: "tier1_cooldown",
            };

            const tier10Patron: PatronUser = {
                discordID: "tier10_cooldown",
                amount_cents: 1000, // $10
                userId: "tier10_cooldown",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1_cooldown" }, tier1Patron);
            await cache.put(testDbName, "patrons", { discordID: "tier10_cooldown" }, tier10Patron);

            const tier1Cooldown = await patreonFuncs.getPlayerCooldown("tier1_cooldown");
            const tier10Cooldown = await patreonFuncs.getPlayerCooldown("tier10_cooldown");

            // Higher tier should have better (lower or equal) cooldowns
            assert.ok(tier10Cooldown.player <= tier1Cooldown.player);
            assert.ok(tier10Cooldown.guild <= tier1Cooldown.guild);
        });
    });

    describe("tier calculation", () => {
        it("assigns tier 0 for $0", async () => {
            const patron: PatronUser = {
                discordID: "tier0",
                amount_cents: 0,
                userId: "tier0",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier0" }, patron);

            const result = await patreonFuncs.getPatronUser("tier0");

            // Should return null for declined/zero tier
            assert.strictEqual(result, null);
        });

        it("assigns tier 1 for $1-$4.99", async () => {
            const patron: PatronUser = {
                discordID: "tier1_range",
                amount_cents: 250, // $2.50
                userId: "tier1_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier1_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier1_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
        });

        it("assigns tier 5 for $5-$9.99", async () => {
            const patron: PatronUser = {
                discordID: "tier5_range",
                amount_cents: 750, // $7.50
                userId: "tier5_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier5_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier5_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });

        it("assigns tier 10 for $10+", async () => {
            const patron: PatronUser = {
                discordID: "tier10_range",
                amount_cents: 1500, // $15
                userId: "tier10_range",
            };

            await cache.put(testDbName, "patrons", { discordID: "tier10_range" }, patron);

            const result = await patreonFuncs.getPatronUser("tier10_range");

            assert.ok(result);
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });
    });

    describe("patron status filtering", () => {
        it("includes active patrons", async () => {
            const activePatron: PatronUser = {
                discordID: "active",
                amount_cents: 500,
                userId: "active",
            };

            await cache.put(testDbName, "patrons", { discordID: "active" }, activePatron);

            const result = await patreonFuncs.getPatronUser("active");

            assert.ok(result);
            assert.strictEqual(result.discordID, "active");
        });

    });

    describe("edge cases (patreon)", () => {
        it("handles patron with exactly $1", async () => {
            const patron: PatronUser = {
                discordID: "exactly_1",
                amount_cents: 100,
                userId: "exactly_1",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_1" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_1");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 100);
        });

        it("handles patron with exactly $5", async () => {
            const patron: PatronUser = {
                discordID: "exactly_5",
                amount_cents: 500,
                userId: "exactly_5",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_5" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_5");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 500);
        });

        it("handles patron with exactly $10", async () => {
            const patron: PatronUser = {
                discordID: "exactly_10",
                amount_cents: 1000,
                userId: "exactly_10",
            };

            await cache.put(testDbName, "patrons", { discordID: "exactly_10" }, patron);

            const result = await patreonFuncs.getPatronUser("exactly_10");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 1000);
        });

        it("handles very high patron amount", async () => {
            const patron: PatronUser = {
                discordID: "whale",
                amount_cents: 10000, // $100
                userId: "whale",
            };

            await cache.put(testDbName, "patrons", { discordID: "whale" }, patron);

            const result = await patreonFuncs.getPatronUser("whale");

            assert.ok(result);
            assert.strictEqual(result.amount_cents, 10000);
            // Should get highest tier benefits
            assert.ok(result.playerTime !== undefined);
            assert.ok(result.guildTime !== undefined);
        });
    });

    // Payout warning/result alerts are keyed to a payout cycle, not an exact minute, so a
    // dropped fetch (transient comlink error) on the payout-warning minute no longer loses
    // the alert - the next successful tick within the window still fires it, exactly once.
    describe("handleArenaAlerts() payout self-heal", () => {
        const ALLY = 888777666;
        const now = 1_000_000_000_000;

        const mkPlayer = (): PlayerArenaRes => ({
            name: "PayoutTest",
            allyCode: ALLY,
            arena: { char: { rank: 5 }, ship: { rank: null } },
            poUTCOffsetMinutes: 0,
        });
        // now + timeLeft is the payout instant; a later tick advances now and drops timeLeft by
        // the same amount, so the cycle id stays constant. Callers vary nowOverride/timeLeft together.
        // The once-per-cycle markers live on user.arenaAlert.alerted, so reusing the same user
        // object across calls models the persisted state a later tick would read back.
        const callAlerts = (acc: ArenaPlayer, user: UserConfig, timeLeft: number, nowOverride: number = now) =>
            (patreonFuncs as any).handleArenaAlerts(
                "char",
                mkPlayer(),
                acc,
                user,
                { discordID: "hist_test_user" },
                timeLeft,
                { rank: 0, climb: 0 },
                nowOverride,
            );

        beforeEach(() => {
            sentDMs.length = 0;
        });

        it("fires the payout warning on the first tick inside the window even if the exact minute was missed", async () => {
            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            // 29 minutes out with a 30-minute warning - the exact 30 tick was dropped
            await callAlerts(acc, user, 29 * constants.minMS);

            assert.strictEqual(sentDMs.length, 1, "expected the warning to still fire one minute late");
            assert.ok(sentDMs[0]?.embeds?.[0]?.description?.includes("arena payout is in"), "expected a payout warning DM");
        });

        it("does not resend the payout warning within the same payout cycle", async () => {
            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            await callAlerts(acc, user, 30 * constants.minMS);
            assert.strictEqual(sentDMs.length, 1, "first tick in the window should fire once");

            // A minute later (same payout cycle: now +1min, timeLeft -1min) - must not fire again
            await callAlerts(acc, user, 29 * constants.minMS, now + constants.minMS);
            assert.strictEqual(sentDMs.length, 1, "the warning must fire at most once per payout cycle");
        });

        it("records the warn marker on the user's own arenaAlert, keyed by ally code", async () => {
            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            await callAlerts(acc, user, 30 * constants.minMS);
            // Per-recipient storage: a shared account doc must NOT carry the marker
            assert.strictEqual(user.arenaAlert.alerted?.[String(ALLY)]?.charWarn, now + 30 * constants.minMS);
        });

        it("fires the payout result just after payout, self-healing a dropped minTil===0 tick", async () => {
            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0, enablePayoutResult: true },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            // Payout happened 2 minutes ago: next payout is ~a day out, so minTil never hit 0 on a live tick
            const timeLeft = constants.dayMS - 2 * constants.minMS;
            await callAlerts(acc, user, timeLeft);
            assert.strictEqual(sentDMs.length, 1, "expected the payout result to fire shortly after payout");
            assert.ok(sentDMs[0]?.embeds?.[0]?.description?.includes("payout ended"), "expected a payout result DM");

            // A minute later (same payout cycle: now +1min, timeLeft -1min) - must not resend
            await callAlerts(acc, user, timeLeft - constants.minMS, now + constants.minMS);
            assert.strictEqual(sentDMs.length, 1, "the payout result must fire at most once per cycle");
        });

        it("lets two users on the same account each get their own warning at their own minute", async () => {
            // Regression: a shared-doc marker used to let the first user's alert suppress the second's
            const userEarly = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 60, enablePayoutResult: false },
            } as unknown as UserConfig;
            const userLate = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            // 60 min out: only the 60-minute user should fire
            await callAlerts(acc, userEarly, 60 * constants.minMS);
            await callAlerts(acc, userLate, 60 * constants.minMS);
            assert.strictEqual(sentDMs.length, 1, "only the 60-minute user fires at 60 min out");

            // 30 min out: the 30-minute user must still fire even though the other already alerted this cycle
            await callAlerts(acc, userEarly, 30 * constants.minMS, now + 30 * constants.minMS);
            await callAlerts(acc, userLate, 30 * constants.minMS, now + 30 * constants.minMS);
            assert.strictEqual(sentDMs.length, 2, "the 30-minute user must not be suppressed by the other user's marker");
        });

        it("still tracks rank when the DM user fetch fails, instead of aborting", async () => {
            // A transient users.fetch rejection must be contained so rank/climb tracking (which runs
            // after the DM block) still happens - otherwise a blip stops persisting ranks that tick.
            const failClient = {
                user: { id: "bot123" },
                users: {
                    fetch: async () => {
                        throw new Error("Unknown User");
                    },
                },
            } as unknown as Client<true>;
            const funcs = new PatreonFuncs();
            funcs.init(failClient);

            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            await assert.doesNotReject(
                (funcs as any).handleArenaAlerts(
                    "char",
                    mkPlayer(),
                    acc,
                    user,
                    { discordID: "fetchfail_user" },
                    29 * constants.minMS,
                    { rank: 0, climb: 0 },
                    now,
                ),
                "a users.fetch failure must not reject out of handleArenaAlerts",
            );
            assert.strictEqual(acc.lastCharRank, 5, "rank tracking must still run when the DM fetch fails");
        });

        it("does not mark the warn cycle when the DM send fails, so it retries next tick", async () => {
            // A failed DM send must NOT record the once-per-cycle marker - otherwise a transient
            // send blip permanently suppresses the alert (the channel path defers the same way).
            let sendOk = false;
            const captured: { embeds?: { description?: string }[] }[] = [];
            const flakyClient = {
                user: { id: "bot123" },
                users: {
                    fetch: async () => ({
                        send: async (msg: { embeds?: { description?: string }[] }) => {
                            if (!sendOk) throw new Error("Cannot send messages to this user");
                            captured.push(msg);
                            return msg;
                        },
                    }),
                },
            } as unknown as Client<true>;
            const funcs = new PatreonFuncs();
            funcs.init(flakyClient);

            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "PayoutTest" };

            const call = (timeLeft: number, nowOverride: number) =>
                (funcs as any).handleArenaAlerts("char", mkPlayer(), acc, user, { discordID: "senfail_user" }, timeLeft, { rank: 0, climb: 0 }, nowOverride);

            // First tick: send fails -> no marker recorded
            await call(30 * constants.minMS, now);
            assert.strictEqual(captured.length, 0, "the DM did not actually deliver");
            assert.strictEqual(user.arenaAlert.alerted?.[String(ALLY)]?.charWarn, undefined, "a failed send must not mark the cycle");

            // Next tick, same cycle, send now works -> the warning is retried and delivered
            sendOk = true;
            await call(29 * constants.minMS, now + constants.minMS);
            assert.strictEqual(captured.length, 1, "the previously-failed warning must be retried once the DM succeeds");
            assert.strictEqual(user.arenaAlert.alerted?.[String(ALLY)]?.charWarn, now + 30 * constants.minMS, "a delivered warning records the cycle marker");
        });

        it("closes out the cycle when the recipient cannot receive DMs at all", async () => {
            // 50007 = "Cannot send messages to this user" - DMs closed or the bot blocked. Unlike a
            // transient failure this cannot succeed on a later tick, so retrying it across every
            // remaining tick of the warn window just repeats a guaranteed failure (and one error
            // log line each) every cycle, forever. Close the cycle instead.
            const now = Date.now();
            let attempts = 0;
            const blockedClient = {
                user: { id: "bot123" },
                users: {
                    fetch: async () => ({
                        send: async () => {
                            attempts++;
                            throw Object.assign(new Error("Cannot send messages to this user"), { code: 50007 });
                        },
                    }),
                },
            } as unknown as Client<true>;
            const funcs = new PatreonFuncs();
            funcs.init(blockedClient);

            const user = {
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 30, enablePayoutResult: false },
            } as unknown as UserConfig;
            const acc: ArenaPlayer = { allyCode: ALLY, name: "BlockedDMs" };

            const call = (timeLeft: number, nowOverride: number) =>
                (funcs as any).handleArenaAlerts("char", mkPlayer(), acc, user, { discordID: "blocked_user" }, timeLeft, { rank: 0, climb: 0 }, nowOverride);

            await call(30 * constants.minMS, now);
            assert.strictEqual(attempts, 1, "one attempt is made before we know it is undeliverable");
            assert.strictEqual(
                user.arenaAlert.alerted?.[String(ALLY)]?.charWarn,
                now + 30 * constants.minMS,
                "an undeliverable recipient must still close the cycle so it is not retried",
            );

            // Remaining ticks inside the same warn window must not attempt the DM again
            await call(29 * constants.minMS, now + constants.minMS);
            await call(28 * constants.minMS, now + 2 * constants.minMS);
            assert.strictEqual(attempts, 1, "a closed cycle must not re-attempt a DM that cannot be delivered");
        });
    });

    describe("processArenaAlerts()", () => {
        beforeEach(async () => {
            sentDMs.length = 0;
            try {
                await client.db(testDbName).collection("users").deleteMany({ id: "hist_test_user" });
                await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 });
            } catch (e) {
                // ignore
            }
        });

        it("updates lastCharRank and lastShipRank in arenaPlayers for a patron with no arenaAlert config", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            // User has accounts but NO arenaAlert - history/rank tracking should still run
            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;
            await cache.put(testDbName, "users", { id: "hist_test_user" }, user);

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "HistPlayer",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: 15 } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            // Flush arenaPlayerMap to DB (normally done by arenaTick)
            await arenaPlayerRegistry.batchUpsert([...arenaPlayerMap.values()]);

            const playerDoc = await client.db(testDbName).collection("arenaPlayers").findOne({ allyCode: 888777666 });
            assert.ok(playerDoc, "arenaPlayers doc should exist after processArenaAlerts");
            assert.strictEqual(playerDoc.lastCharRank, 42, "lastCharRank should be updated");
            assert.strictEqual(playerDoc.lastShipRank, 15, "lastShipRank should be updated");
        });

        it("sends a rank drop DM when the rank worsens since the stored rank", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "DropTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 => the player dropped and a DM should fire
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "DropTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(sentDMs.length, 1, "expected exactly one rank drop DM");
            const desc = sentDMs[0]?.embeds?.[0]?.description ?? "";
            assert.ok(desc.includes("dropped from 5 to **10**"), `unexpected DM description: ${desc}`);
        });

        it("still sends rank drop DMs without a payout footer when poUTCOffsetMinutes is missing", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NoOffsetTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    // The type requires a number, but live data can omit it - that's the case under test
                    poUTCOffsetMinutes: undefined as unknown as number,
                }],
            ]);

            // Stored rank 5, current rank 10 => the player dropped and a DM should still fire
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "NoOffsetTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(sentDMs.length, 1, "expected the rank drop DM despite the missing payout offset");
            const embed = sentDMs[0]?.embeds?.[0];
            assert.ok(embed?.description?.includes("dropped from 5 to **10**"), `unexpected DM description: ${embed?.description}`);
            // Without the offset there is no payout time - the footer must be omitted, not show a bogus duration
            assert.strictEqual(embed?.footer, undefined, `expected no payout footer, got: ${JSON.stringify(embed?.footer)}`);
            // Rank tracking is independent of payout time and must still update
            assert.strictEqual(arenaPlayerMap.get(888777666)?.lastCharRank, 10, "lastCharRank should still track the new rank");
        });

        it("advances climb tracking when the rank improves", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "ClimbTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 3 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "ClimbTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(888777666);
            assert.strictEqual(doc?.lastCharRank, 3, "lastCharRank should track the new rank");
            assert.strictEqual(doc?.lastCharClimb, 3, "lastCharClimb should advance to the better rank");
            assert.strictEqual(sentDMs.length, 0, "an improvement must not send a drop DM");
        });

        it("adds changed ally codes to changedCodes and skips unchanged ones on a repeat run", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "ChangedTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: 15 } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            const firstRun = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, firstRun, buildRankSnapshot(arenaPlayerMap));
            assert.ok(firstRun.has(888777666), "first run changed the doc, so it must be marked changed");
            assert.ok(arenaPlayerMap.has(888777666), "new doc must land in the map so the flush can find it");

            // Second run with identical data: ranks unchanged, history inside the 5-minute
            // dedup window => nothing changed, nothing should be marked changed.
            const secondRun = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, secondRun, buildRankSnapshot(arenaPlayerMap));
            assert.strictEqual(secondRun.size, 0, "unchanged docs must not be marked changed");
        });

        it("refreshes the stored name when the API reports a rename", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NewName",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OldName", lastCharRank: 42, lastCharClimb: 42 }],
            ]);

            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "NewName");
            assert.ok(changedCodes.has(888777666), "a rename must mark the doc changed");
        });

        it("sends a rank drop DM to every patron registered to the same account", async () => {
            const patron1: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            const patron2: ActivePatron = { discordID: "hist_test_user2", amount_cents: 100 };
            const mkUser = (id: string) =>
                ({
                    id,
                    accounts: [888777666],
                    primaryAllyCode: 888777666,
                    arenaAlert: { enableRankDMs: "all", arena: "both", payoutWarning: 0 },
                }) as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "SharedDrop",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 => a drop both patrons should hear about
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "SharedDrop", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const rankSnapshot = buildRankSnapshot(arenaPlayerMap);

            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processArenaAlerts(patron1, mkUser("hist_test_user"), playerMap, arenaPlayerMap, changedCodes, rankSnapshot);
            await (patreonFuncs as any).processArenaAlerts(patron2, mkUser("hist_test_user2"), playerMap, arenaPlayerMap, changedCodes, rankSnapshot);

            assert.strictEqual(sentDMs.length, 2, "both patrons must get the rank drop DM, not just whoever is processed first");
        });

        it("does not clobber the stored name with an empty API name", async () => {
            const patron: ActivePatron = { discordID: "hist_test_user", amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: "hist_test_user" }, patron);

            const user = {
                id: "hist_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "",
                    allyCode: 888777666,
                    arena: { char: { rank: 42 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "KeepMe", lastCharRank: 42, lastCharClimb: 42 }],
            ]);

            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.strictEqual(arenaPlayerMap.get(888777666)?.name, "KeepMe");
        });
    });

    describe("processShardPatron()", () => {
        beforeEach(async () => {
            await client.db(testDbName).collection("users").deleteMany({ id: { $in: ["shard_test_user", "shard_test_user2"] } }).catch(() => {});
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 }).catch(() => {});
        });

        it("keeps the stored doc name when the API name is empty", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Payout-times-only config: payoutTimesOn true, anyLogOn false => no broadcastEval send
            // paths, and aw.arena.char.enabled false keeps checkRanks() out of the picture.
            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Post-migration state: the name lives on the arenaPlayers doc, not the watch entry
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "Stored" }],
            ]);
            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "the doc should still be in the map");
            assert.strictEqual(doc.name, "Stored", "an empty API name must not clobber the stored name");
            assert.strictEqual(doc.lastCharRank, 5);
            assert.ok(changedCodes.has(888777666), "the rank change must mark the doc changed");
        });

        it("does not write the user doc when no poOffset changed", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // poOffset already matches the API value, so the user doc has nothing to update
            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NoWrite",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // The user doc was intentionally never inserted - an unconditional updateUser would upsert it
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            const written = await client.db(testDbName).collection("users").findOne({ id: "shard_test_user" });
            assert.strictEqual(written, null, "the user doc must not be written when nothing in it changed");
        });

        it("writes the user doc when a poOffset changed", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "OffsetMoved",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 120,
                }],
            ]);

            const changed = await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            // arenaTick owns the write now; processShardPatron reports the dirty flag and mutates in place
            assert.strictEqual(changed, true, "a poOffset change must mark the user doc dirty");
            assert.strictEqual(user.arenaWatch.allyCodes[0].poOffset, 120);
        });

        it("keeps the stored poOffset when the API omits poUTCOffsetMinutes", async () => {
            // A player can return arena ranks with no poUTCOffsetMinutes (the DM path guards the
            // same case). The stored offset must survive that tick, not be clobbered to undefined -
            // otherwise the account falls off the payout schedule until a good tick restores it.
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777669, mention: null, poOffset: 120 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777669, {
                    name: "NoOffset",
                    allyCode: 888777669,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    // poUTCOffsetMinutes intentionally omitted
                }],
            ] as [number, PlayerArenaRes][]);

            const changed = await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            assert.strictEqual(user.arenaWatch.allyCodes[0].poOffset, 120, "stored poOffset must not be overwritten with undefined");
            assert.strictEqual(changed, false, "a tick that only lost the offset must not mark the doc dirty");
        });

        it("keeps over-limit watch entries in the user doc when writing back", async () => {
            // Tier 1 only processes the first entry, but the rest must stay stored so they
            // come back into play if the patron raises their tier
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [
                        { allyCode: 888777666, mention: null, poOffset: 0 },
                        { allyCode: 888777667, mention: null, poOffset: 60 },
                        { allyCode: 888777668, mention: null, poOffset: 120 },
                    ],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            // poOffset change on the processed entry forces the user-doc write
            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "KeepRest",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 30,
                }],
            ]);

            const changed = await (patreonFuncs as any).processShardPatron(patron, user, playerMap, new Map<number, ArenaPlayer>(), new Set<number>(), new Map());

            // Over-limit entries stay in the in-memory doc the caller persists; only entry 0 is processed
            assert.strictEqual(changed, true, "the poOffset change must mark the doc dirty");
            assert.strictEqual(user.arenaWatch.allyCodes.length, 3, "over-limit watch entries must not be dropped");
            assert.strictEqual(user.arenaWatch.allyCodes[0].poOffset, 30);
            assert.strictEqual(user.arenaWatch.allyCodes[1].poOffset, 60, "unprocessed entries must be untouched");
            assert.strictEqual(user.arenaWatch.allyCodes[2].poOffset, 120, "unprocessed entries must be untouched");
        });

        it("refreshes the persisted name when the API name differs from an existing doc", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user2", amount_cents: 100 };

            const user = {
                id: "shard_test_user2",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, name: "Stored", mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "NewApiName",
                    allyCode: 888777666,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OldStoredName", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const changedCodes = new Set<number>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(888777666);
            assert.ok(doc, "the existing doc must remain in the map");
            assert.strictEqual(doc.name, "NewApiName", "the persisted name must be refreshed to the new API name");
            assert.ok(changedCodes.has(888777666), "a name refresh must mark the doc changed");
        });
    });

    describe("arenaTick consumer ordering", () => {
        beforeEach(async () => {
            sentDMs.length = 0;
            await client.db(testDbName).collection("users").deleteMany({ id: "ordering_test_user" }).catch(() => {});
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: 888777666 }).catch(() => {});
        });

        it("still detects a watch rank change after processArenaAlerts already updated the shared doc", async () => {
            const patron: ActivePatron = { discordID: "ordering_test_user", amount_cents: 500 };

            // The same account is both registered (accounts) and watched (arenaWatch) -
            // payout-only watch config keeps broadcastEval send paths out of the picture
            const user = {
                id: "ordering_test_user",
                accounts: [888777666],
                primaryAllyCode: 888777666,
                arenaWatch: {
                    allyCodes: [{ allyCode: 888777666, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            const playerMap = new Map<number, PlayerArenaRes>([
                [888777666, {
                    name: "OrderingTest",
                    allyCode: 888777666,
                    arena: { char: { rank: 10 }, ship: { rank: null } },
                    poUTCOffsetMinutes: 0,
                }],
            ]);

            // Stored rank 5, current rank 10 - both consumers must see this change
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [888777666, { allyCode: 888777666, name: "OrderingTest", lastCharRank: 5, lastCharClimb: 5 }],
            ]);
            const rankSnapshot = buildRankSnapshot(arenaPlayerMap);

            const changedCodes = new Set<number>();
            // Same order as arenaTick: alerts first, then the watch/shard pass
            await (patreonFuncs as any).processArenaAlerts(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot);
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, changedCodes, rankSnapshot);

            const doc = arenaPlayerMap.get(888777666);
            assert.strictEqual(doc?.lastCharRank, 10, "doc should hold the current rank");
            assert.strictEqual(doc?.lastCharChange, -5, "watch pass must compute the change from the tick-start rank, not the already-updated doc");
        });
    });

    describe("recordHistoryAtPayout()", () => {
        it("does not write an entry when the rank is nullish at payout", () => {
            // A watched ship-only (or char-only) account has no rank for the other arena -
            // an entry of { rank: null } must never land in the history
            const fromUndefined = (patreonFuncs as any).recordHistoryAtPayout(undefined, undefined, true);
            assert.strictEqual(fromUndefined, undefined, "no entry should be created for an undefined rank");

            const existing = [{ rank: 5, ts: 1000 }];
            const fromNull = (patreonFuncs as any).recordHistoryAtPayout(existing, null, true);
            assert.strictEqual(fromNull, existing, "history must be returned unchanged for a null rank");
        });

        it("writes an entry for a real rank inside the post-payout window", () => {
            const result = (patreonFuncs as any).recordHistoryAtPayout(undefined, 12, true);
            assert.strictEqual(result?.length, 1);
            assert.strictEqual(result?.[0].rank, 12);
        });

        it("does not write outside the post-payout window", () => {
            // atPayout=false (payout still upcoming or long past) must never write
            const result = (patreonFuncs as any).recordHistoryAtPayout(undefined, 12, false);
            assert.strictEqual(result, undefined, "no entry should be written before the payout window");
        });
    });

    describe("processShardPatron() at payout minute", () => {
        const PO_ALLY_CODE = 888777666;

        beforeEach(async () => {
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: PO_ALLY_CODE });
        });

        it("does not record a charHist entry when the account has no char rank", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Compute a poOffset that puts the char payout (~18h offset) ~30s AGO, so we're inside
            // the post-payout window (justAfterPayout) - the only reason not to write is the null rank.
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now + 30000) / 60000;

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: PO_ALLY_CODE, mention: null, poOffset }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "chan1", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            // Ship-only account: char rank is null and there is no stored doc
            const playerMap = new Map<number, PlayerArenaRes>([
                [PO_ALLY_CODE, {
                    name: "ShipOnly",
                    allyCode: PO_ALLY_CODE,
                    arena: { char: { rank: null }, ship: { rank: 5 } },
                    poUTCOffsetMinutes: poOffset,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (patreonFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            const doc = arenaPlayerMap.get(PO_ALLY_CODE);
            assert.ok(doc, "a stub doc should exist for the watched account");
            assert.strictEqual(doc.charHist, undefined, `no charHist entry should be written, got: ${JSON.stringify(doc.charHist)}`);
        });
    });

    describe("processShardPatron() alert log output", () => {
        const LOG_ALLY_CODE = 888777666;
        let logFuncs: PatreonFuncs;
        let sentLogs: string[];

        before(() => {
            sentLogs = [];
            const fakeChannel = {
                id: "aw-chan",
                type: 0,
                guild: {},
                permissionsFor: () => ({ has: () => true }),
                send: async (payload: string) => {
                    sentLogs.push(payload);
                    return { id: "aw-msg-1" };
                },
            };
            const channelsCache = { get: (id: string) => (id === "aw-chan" ? fakeChannel : undefined) };
            const logClient = {
                user: { id: "bot123", username: "TestBot" },
                channels: { cache: channelsCache },
                shard: {
                    broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                        await fn({ channels: { cache: channelsCache }, user: { id: "bot123" } }, opts.context),
                    ],
                },
            } as unknown as Client<true>;
            logFuncs = new PatreonFuncs();
            logFuncs.init(logClient);
        });

        beforeEach(async () => {
            sentLogs.length = 0;
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: LOG_ALLY_CODE });
        });

        it("never renders 'undefined' as the player name when neither the doc nor the API has one", async () => {
            const patron: ActivePatron = { discordID: "shard_test_user", amount_cents: 100 };

            // Pin the char payout (~18h offset) ~30s AGO so we're inside the post-payout window
            // and the payout-result line renders
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now + 30000) / 60000;

            const user = {
                id: "shard_test_user",
                accounts: [],
                arenaWatch: {
                    // Post-migration entry: no embedded name, payout-result reporting on
                    allyCodes: [{ allyCode: LOG_ALLY_CODE, mention: null, poOffset, result: "char" }],
                    arena: {
                        char: { channel: "aw-chan", enabled: true },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: false, channel: null, msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;

            // No arenaPlayers doc and an empty API name - worst case for name resolution
            const playerMap = new Map<number, PlayerArenaRes>([
                [LOG_ALLY_CODE, {
                    name: "",
                    allyCode: LOG_ALLY_CODE,
                    arena: { char: { rank: 5 }, ship: { rank: null } },
                    poUTCOffsetMinutes: poOffset,
                }],
            ]);

            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            await (logFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap));

            assert.ok(sentLogs.length, "expected an alert log message to be sent");
            const logText = sentLogs.join("\n");
            assert.ok(!logText.includes("undefined"), `player name must never render as 'undefined': ${logText}`);
            assert.ok(logText.includes(String(LOG_ALLY_CODE)), `expected the ally code as the name fallback: ${logText}`);
        });
    });

    describe("processShardPatron() channel rank anchoring + payout self-heal", () => {
        // File-unique ally codes so parallel test files don't collide on shared collections
        const A_ANCHOR = 888777670;
        const A_FAIL = 888777671;
        const A_WARN = 888777672;
        const A_FRESH = 888777673;
        const A_FILTERED = 888777674;
        const A_DISABLED = 888777675;
        const A_STALE_WARN = 888777676;
        const A_FOOTER = 888777677;
        const A_REPORT_NONE = 888777678;
        const A_FLEET_OFF = 888777679;
        const A_GONE_CHAN = 888777680;
        const A_RECOVER = 888777681;
        let awFuncs: PatreonFuncs;
        let sent: string[];
        let sendOk: boolean;

        before(() => {
            sent = [];
            sendOk = true;
            const fakeChannel = {
                type: 0,
                permissionsFor: () => ({ has: () => true }),
                send: async (payload: string) => {
                    if (!sendOk) throw new Error("send failed");
                    sent.push(payload);
                    return { id: "m1" };
                },
            };
            const channelsCache = { get: (id: string) => (id === "aw-chan" ? fakeChannel : undefined) };
            const awClient = {
                user: { id: "bot123" },
                channels: { cache: channelsCache },
                shard: {
                    broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                        await fn({ channels: { cache: channelsCache }, user: { id: "bot123" } }, opts.context),
                    ],
                },
            } as unknown as Client<true>;
            awFuncs = new PatreonFuncs();
            awFuncs.init(awClient);
        });

        beforeEach(() => {
            sent.length = 0;
            sendOk = true;
        });

        const mkUser = (id: string, entry: Record<string, unknown>, awExtra: Record<string, unknown> = {}) =>
            ({
                id,
                accounts: [],
                arenaWatch: {
                    allyCodes: [entry],
                    arena: { char: { channel: "aw-chan", enabled: true }, fleet: { channel: null, enabled: false } },
                    payout: { char: { enabled: false, channel: null, msgID: null }, fleet: { enabled: false, channel: null, msgID: null } },
                    ...awExtra,
                },
            }) as unknown as UserConfig;

        it("anchors on last-announced, shows the net change, and flags a missed span", async () => {
            // lastCharAnnounced 5, but the observed rank already advanced to 8 (a prior send failed)
            const user = mkUser("anchor_user", { allyCode: A_ANCHOR, mention: null, poOffset: 0, lastCharAnnounced: 5 });
            const patron: ActivePatron = { discordID: "anchor_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_ANCHOR, { allyCode: A_ANCHOR, name: "Anchored", lastCharRank: 8 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_ANCHOR, { name: "Anchored", allyCode: A_ANCHOR, arena: { char: { rank: 8 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
            ]);

            const changed = await (awFuncs as any).processShardPatron(
                patron,
                user,
                playerMap,
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );

            const text = sent.join("\n");
            assert.ok(text.includes("dropped from 5 to 8"), `expected the net change 5->8: ${text}`);
            assert.ok(text.includes("net change"), `expected the missed-updates footer: ${text}`);
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 8, "a delivered alert advances last-announced");
            assert.strictEqual(changed, true);
        });

        it("does not advance last-announced when the channel send fails", async () => {
            const user = mkUser("anchorfail_user", { allyCode: A_FAIL, mention: null, poOffset: 0 });
            const patron: ActivePatron = { discordID: "anchorfail_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_FAIL, { allyCode: A_FAIL, name: "FailSend", lastCharRank: 5 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_FAIL, { name: "FailSend", allyCode: A_FAIL, arena: { char: { rank: 8 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
            ]);

            sendOk = false;
            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), Date.now());

            // A failed send freezes last-announced at the anchor (5), NOT the new rank (8), so the
            // next tick still sees 8 !== 5 and re-alerts - the change isn't silently dropped.
            assert.strictEqual(
                user.arenaWatch.allyCodes[0].lastCharAnnounced,
                5,
                "a failed send must leave last-announced at the anchor so the change is retried next tick",
            );

            // Prove the retry: same change, send now succeeds -> re-alerts and advances to 8
            sendOk = true;
            sent.length = 0;
            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), Date.now());
            assert.ok(sent.join("\n").includes("from 5 to 8"), "the previously-failed change must be retried on the next tick");
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 8, "a delivered retry advances last-announced");
        });

        it("advances last-announced when no shard can post to the channel at all", async () => {
            // A channel no shard can see (deleted, bot kicked, ViewChannel revoked) is not a
            // delivery failure to retry - there is nothing to retry against. Holding the anchor
            // here would rebuild and re-broadcast the same alert every tick forever, since nothing
            // about a missing channel changes on its own.
            const user = mkUser(
                "gonechan_user",
                { allyCode: A_GONE_CHAN, mention: null, poOffset: 0 },
                { arena: { char: { channel: "gone-chan", enabled: true }, fleet: { channel: null, enabled: false } } },
            );
            const patron: ActivePatron = { discordID: "gonechan_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_GONE_CHAN, { allyCode: A_GONE_CHAN, name: "GoneChan", lastCharRank: 5 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [
                    A_GONE_CHAN,
                    { name: "GoneChan", allyCode: A_GONE_CHAN, arena: { char: { rank: 8 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 },
                ],
            ]);

            await (awFuncs as any).processShardPatron(
                patron,
                user,
                playerMap,
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );

            assert.strictEqual(sent.length, 0, "nothing can be sent to a channel no shard can see");
            assert.strictEqual(
                user.arenaWatch.allyCodes[0].lastCharAnnounced,
                8,
                "an undeliverable channel must still close out the rank span, or it re-alerts every tick forever",
            );

            // Prove it terminates: the rank has not moved, so the next tick has nothing to say
            const secondUser = mkUser(
                "gonechan_user",
                { allyCode: A_GONE_CHAN, mention: null, poOffset: 0, lastCharAnnounced: 8 },
                { arena: { char: { channel: "gone-chan", enabled: true }, fleet: { channel: null, enabled: false } } },
            );
            const changed = await (awFuncs as any).processShardPatron(
                patron,
                secondUser,
                playerMap,
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );
            assert.strictEqual(changed, false, "a settled anchor on a dead channel must stop dirtying the user doc");
        });

        it("resumes alerting as soon as a previously undeliverable channel works again", async () => {
            // Nothing about an undeliverable channel is latched: availability is re-tested inside
            // broadcastEval on every send, so restoring the channel (or the bot's permissions) needs
            // no intervention. The cost of advancing the anchor while it was dead is only that the
            // changes from that period aren't replayed - alerting itself resumes on the next change.
            const entry = { allyCode: A_RECOVER, mention: null, poOffset: 0 };
            const user = mkUser(
                "recover_user",
                entry,
                { arena: { char: { channel: "gone-chan", enabled: true }, fleet: { channel: null, enabled: false } } },
            );
            const patron: ActivePatron = { discordID: "recover_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_RECOVER, { allyCode: A_RECOVER, name: "Recover", lastCharRank: 5 }]]);
            const mkPlayerMap = (rank: number) =>
                new Map<number, PlayerArenaRes>([
                    [A_RECOVER, { name: "Recover", allyCode: A_RECOVER, arena: { char: { rank }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
                ]);

            // While the channel is unreachable the anchor still tracks forward
            await (awFuncs as any).processShardPatron(
                patron,
                user,
                mkPlayerMap(8),
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );
            assert.strictEqual(sent.length, 0, "nothing delivered while the channel was unreachable");
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 8);

            // Perms restored: point the same watch entry at a channel the shard can see. The next
            // rank change must deliver, with no cooldown or manual reset in between.
            user.arenaWatch.arena.char.channel = "aw-chan";
            arenaPlayerMap.set(A_RECOVER, { allyCode: A_RECOVER, name: "Recover", lastCharRank: 8 });

            await (awFuncs as any).processShardPatron(
                patron,
                user,
                mkPlayerMap(3),
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );
            assert.ok(sent.join("\n").includes("from 8 to 3"), `alerts must resume immediately: ${sent.join("\n")}`);
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 3, "and the anchor tracks the delivered rank again");
        });

        it("does not alert on a brand-new account with no prior rank (no 'rank 0' noise)", async () => {
            // No arenaPlayers doc and no prior announce => anchor is 0; the rank line must be suppressed
            const user = mkUser("fresh_user", { allyCode: A_FRESH, mention: null, poOffset: 0 });
            const patron: ActivePatron = { discordID: "fresh_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>();
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_FRESH, { name: "FreshAcct", allyCode: A_FRESH, arena: { char: { rank: 7 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), Date.now());

            assert.ok(!sent.join("\n").includes("from 0 to"), `must not emit a 'rank 0 -> X' alert: ${sent.join("\n")}`);
            assert.strictEqual(sent.length, 0, "a first-observation with no baseline should send nothing");
            // The observed rank still persists so the next real change has a baseline
            assert.strictEqual(arenaPlayerMap.get(A_FRESH)?.lastCharRank, 7, "observed rank is still recorded for next time");
        });

        it("advances last-announced for a change report=drop filtered out, instead of wedging the anchor", async () => {
            // report: "drop" means climbs are deliberately not posted. That is NOT a delivery
            // failure, so the anchor must still move - otherwise every later drop is measured from
            // a rank the watcher moved past long ago, and while the anchor stays above the current
            // rank every change reads as a climb and is filtered too, silencing the account for good.
            const user = mkUser("filtered_user", { allyCode: A_FILTERED, mention: null, poOffset: 0, lastCharAnnounced: 5 }, { report: "drop" });
            const patron: ActivePatron = { discordID: "filtered_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [A_FILTERED, { allyCode: A_FILTERED, name: "Filtered", lastCharRank: 5 }],
            ]);

            // Climb 5 -> 2: filtered out by report=drop, so nothing is sent
            await (awFuncs as any).processShardPatron(
                patron,
                user,
                new Map<number, PlayerArenaRes>([
                    [A_FILTERED, { name: "Filtered", allyCode: A_FILTERED, arena: { char: { rank: 2 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
                ]),
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );
            assert.strictEqual(sent.length, 0, "a climb must not be posted when report=drop");
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 2, "an unposted (filtered) change must still move the anchor");

            // Now a real drop 2 -> 3: reported against the current rank, not the stale 5
            await (awFuncs as any).processShardPatron(
                patron,
                user,
                new Map<number, PlayerArenaRes>([
                    [A_FILTERED, { name: "Filtered", allyCode: A_FILTERED, arena: { char: { rank: 3 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
                ]),
                arenaPlayerMap,
                new Set<number>(),
                buildRankSnapshot(arenaPlayerMap),
                Date.now(),
            );
            const text = sent.join("\n");
            assert.ok(text.includes("dropped from 2 to 3"), `expected the drop measured from the current rank: ${text}`);
            assert.ok(!text.includes("net change"), `a filtered climb is not a missed update: ${text}`);
        });

        it("does not track an announce anchor for an arena whose channel alerts are off", async () => {
            // char alerts disabled (fleet on, so the function still runs): no char alert can ever be
            // posted, so writing an anchor would only churn the user doc on every rank change and
            // skew the first alert if they re-enable it
            const user = mkUser(
                "disabled_user",
                { allyCode: A_DISABLED, mention: null, poOffset: 0 },
                { arena: { char: { channel: "aw-chan", enabled: false }, fleet: { channel: "aw-fleet-chan", enabled: true } } },
            );
            const patron: ActivePatron = { discordID: "disabled_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_DISABLED, { allyCode: A_DISABLED, name: "Disabled", lastCharRank: 5 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_DISABLED, { name: "Disabled", allyCode: A_DISABLED, arena: { char: { rank: 8 }, ship: { rank: null } }, poUTCOffsetMinutes: 0 }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), Date.now());

            assert.strictEqual(sent.length, 0, "nothing should be posted for a disabled arena");
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, undefined, "no anchor should be recorded when alerts are off");
            assert.strictEqual(arenaPlayerMap.get(A_DISABLED)?.lastCharRank, 8, "the observed rank is still tracked");
        });

        it("fires a channel payout warning late in the window and dedups per cycle", async () => {
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            // Char payout (~18h offset) ~29 min out => inside a 30-minute warn window
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 29 * 60000) / 60000;
            const user = mkUser("chanwarn_user", { allyCode: A_WARN, mention: null, poOffset, warn: { min: 30, arena: "char" } });
            const patron: ActivePatron = { discordID: "chanwarn_user", amount_cents: 100 };
            // Stable rank so no rank-change line pollutes the assertions
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_WARN, { allyCode: A_WARN, name: "Warned", lastCharRank: 5, lastCharAnnounced: 5 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_WARN, { name: "Warned", allyCode: A_WARN, arena: { char: { rank: 5 }, ship: { rank: null } }, poUTCOffsetMinutes: poOffset }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now);
            assert.ok(sent.join("\n").includes("**character** arena payout is in"), "the warning should fire even past the exact minute");
            assert.strictEqual(typeof user.arenaWatch.allyCodes[0].alerted?.charWarn, "number", "the warn cycle marker should be recorded");

            // A minute later in the same cycle - must not resend
            sent.length = 0;
            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now + 60000);
            assert.ok(!sent.join("\n").includes("payout is in"), "the warning must not resend within the same payout cycle");
        });

        it("does not fire a stale channel payout warning long past its window", async () => {
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            // Char payout only 5 min out, but the watcher asked for a 30-minute warning. We were
            // down through minute 30, so warning now would read "payout is in 5 minutes" as if it
            // were the 30-minute heads-up - worse than skipping the cycle.
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 5 * 60000) / 60000;
            const user = mkUser("stalewarn_user", { allyCode: A_STALE_WARN, mention: null, poOffset, warn: { min: 30, arena: "char" } });
            const patron: ActivePatron = { discordID: "stalewarn_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [A_STALE_WARN, { allyCode: A_STALE_WARN, name: "StaleWarn", lastCharRank: 5, lastCharAnnounced: 5 }],
            ]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_STALE_WARN, { name: "StaleWarn", allyCode: A_STALE_WARN, arena: { char: { rank: 5 }, ship: { rank: null } }, poUTCOffsetMinutes: poOffset }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now);

            assert.strictEqual(sent.length, 0, `a warning 25 min past its window must be skipped: ${sent.join("\n")}`);
            assert.strictEqual(user.arenaWatch.allyCodes[0].alerted?.charWarn, undefined, "no marker should be written for a skipped warning");
        });

        it("keeps payout warn/result in the arena log channel when report=none silences rank changes", async () => {
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 29 * 60000) / 60000;
            // report=none: the rank moved 5 -> 2, but only the payout warning should be posted, and
            // it goes to the same arena log channel - never to another channel.
            const user = mkUser(
                "reportnone_user",
                { allyCode: A_REPORT_NONE, mention: null, poOffset, lastCharAnnounced: 5, warn: { min: 30, arena: "char" } },
                { report: "none" },
            );
            const patron: ActivePatron = { discordID: "reportnone_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [A_REPORT_NONE, { allyCode: A_REPORT_NONE, name: "NoReport", lastCharRank: 5 }],
            ]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_REPORT_NONE, { name: "NoReport", allyCode: A_REPORT_NONE, arena: { char: { rank: 2 }, ship: { rank: null } }, poUTCOffsetMinutes: poOffset }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now);

            const text = sent.join("\n");
            assert.ok(text.includes("**character** arena payout is in"), `the payout warning must still be delivered: ${text}`);
            assert.ok(!text.includes("climbed"), `report=none must silence rank-change lines: ${text}`);
            assert.ok(!text.includes("dropped"), `report=none must silence rank-change lines: ${text}`);
            // No rank alerts can ever be posted, so no announce anchor should be written - otherwise
            // every rank change would churn the user doc for lines this watcher never receives
            assert.strictEqual(user.arenaWatch.allyCodes[0].lastCharAnnounced, 5, "report=none must not move the announce anchor");
            // The observed rank still tracks, so history and the DM path stay correct
            assert.strictEqual(arenaPlayerMap.get(A_REPORT_NONE)?.lastCharRank, 2, "the observed rank is still recorded");
        });

        it("drops payout warn/result for an arena whose log is disabled, rather than posting it elsewhere", async () => {
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            // Fleet payout (~19h offset) ~29 min out, with a fleet warn configured - but the fleet
            // log is off. Char shares the same channel, which used to smuggle the fleet line out
            // through the combined-channel send path.
            const poOffset = (midnightUTC + 19 * 60 * 60 * 1000 - now - 29 * 60000) / 60000;
            const user = mkUser(
                "fleetoff_user",
                { allyCode: A_FLEET_OFF, mention: null, poOffset, warn: { min: 30, arena: "fleet" } },
                { arena: { char: { channel: "aw-chan", enabled: true }, fleet: { channel: "aw-chan", enabled: false } } },
            );
            const patron: ActivePatron = { discordID: "fleetoff_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([
                [A_FLEET_OFF, { allyCode: A_FLEET_OFF, name: "FleetOff", lastCharRank: 5, lastShipRank: 4, lastCharAnnounced: 5 }],
            ]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_FLEET_OFF, { name: "FleetOff", allyCode: A_FLEET_OFF, arena: { char: { rank: 5 }, ship: { rank: 4 } }, poUTCOffsetMinutes: poOffset }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now);

            assert.ok(!sent.join("\n").includes("**fleet** arena payout"), `a disabled fleet log must not post fleet lines: ${sent.join("\n")}`);
            assert.strictEqual(user.arenaWatch.allyCodes[0].alerted?.fleetWarn, undefined, "no marker for a line that was never sent");
        });

        it("omits the missed-updates footer when no rank line survived the report filter", async () => {
            const now = Date.now();
            const midnightUTC = new Date(now).setUTCHours(0, 0, 0, 0);
            const poOffset = (midnightUTC + 18 * 60 * 60 * 1000 - now - 29 * 60000) / 60000;
            // Announced 5, observed already 8 (a prior send failed) => the change is "missed". But
            // the current rank 2 reads as a climb off the anchor, which report=drop filters out. The
            // message that goes out carries only the payout warning, so there are no net-change
            // numbers for the footer to caveat.
            const user = mkUser(
                "footer_user",
                { allyCode: A_FOOTER, mention: null, poOffset, lastCharAnnounced: 5, warn: { min: 30, arena: "char" } },
                { report: "drop" },
            );
            const patron: ActivePatron = { discordID: "footer_user", amount_cents: 100 };
            const arenaPlayerMap = new Map<number, ArenaPlayer>([[A_FOOTER, { allyCode: A_FOOTER, name: "Footer", lastCharRank: 8 }]]);
            const playerMap = new Map<number, PlayerArenaRes>([
                [A_FOOTER, { name: "Footer", allyCode: A_FOOTER, arena: { char: { rank: 2 }, ship: { rank: null } }, poUTCOffsetMinutes: poOffset }],
            ]);

            await (awFuncs as any).processShardPatron(patron, user, playerMap, arenaPlayerMap, new Set<number>(), buildRankSnapshot(arenaPlayerMap), now);

            const text = sent.join("\n");
            assert.ok(text.includes("payout is in"), `the payout warning should still be posted: ${text}`);
            assert.ok(!text.includes("net change"), `no rank line survived, so the footer must be omitted: ${text}`);
        });
    });

    describe("formatPayouts()", () => {
        it("does not crash when a player has no stored rank and renders N/A", () => {
            const players = [
                {
                    allyCode: 777666555,
                    name: "NoRank",
                    mention: null,
                    poOffset: 0,
                    lastChar: null,
                    lastShip: null,
                    duration: 5,
                    timeTil: "5 minutes until payout.",
                },
            ] as unknown as ArenaWatchAcct[];

            const embed = (patreonFuncs as any).formatPayouts(players, "char");
            assert.ok(embed.fields.length, "expected a payout field");
            assert.ok(embed.fields[0].value.includes("N/A"), `expected N/A rank, got: ${embed.fields[0].value}`);
            assert.ok(embed.fields[0].value.includes("NoRank"), `expected player name, got: ${embed.fields[0].value}`);
        });
    });

    describe("shardTimes()", () => {
        const ST_ALLY_CODE = 777666555;
        const ST_USER_ID = "shardtimes_test_user";
        let stFuncs: PatreonFuncs;
        let sentPayloads: { embeds?: { fields?: { name: string; value: string }[] }[] }[];
        // Runs inside the channel send - after shardTimes has loaded the user doc, before it
        // persists. Lets a test interleave the concurrent write that arenaTick really does.
        let onSend: (() => Promise<void>) | null;

        before(() => {
            sentPayloads = [];
            onSend = null;
            const fakeChannel = {
                id: "st-chan",
                type: 0,
                guild: {},
                permissionsFor: () => ({ has: () => true }),
                send: async (payload: (typeof sentPayloads)[number]) => {
                    sentPayloads.push(payload);
                    await onSend?.();
                    return { id: "st-msg-1" };
                },
            };
            const channelsCache = {
                get: (id: string) => (id === "st-chan" ? fakeChannel : undefined),
                find: (pred: (chan: typeof fakeChannel) => boolean) => (pred(fakeChannel) ? fakeChannel : undefined),
            };
            const stClient = {
                user: { id: "bot123", username: "TestBot" },
                channels: { cache: channelsCache },
                shard: {
                    broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                        await fn({ channels: { cache: channelsCache }, user: { id: "bot123" } }, opts.context),
                    ],
                },
            } as unknown as Client<true>;
            stFuncs = new PatreonFuncs();
            stFuncs.init(stClient);
        });

        beforeEach(async () => {
            sentPayloads.length = 0;
            onSend = null;
            await client.db(testDbName).collection("users").deleteMany({ id: ST_USER_ID });
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: ST_ALLY_CODE });
        });

        after(async () => {
            await client.db(testDbName).collection("users").deleteMany({ id: ST_USER_ID });
            await client.db(testDbName).collection("arenaPlayers").deleteMany({ allyCode: ST_ALLY_CODE });
        });

        it("sends a payout schedule hydrated with name and rank from the arenaPlayers collection", async () => {
            const patron: ActivePatron = { discordID: ST_USER_ID, amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: ST_USER_ID }, patron);

            const user = {
                id: ST_USER_ID,
                accounts: [],
                arenaWatch: {
                    // Post-migration shape: no name/lastChar/lastShip on the watch entry
                    allyCodes: [{ allyCode: ST_ALLY_CODE, mention: null, poOffset: 0 }],
                    arena: {
                        char: { channel: null, enabled: false },
                        fleet: { channel: null, enabled: false },
                    },
                    payout: {
                        char: { enabled: true, channel: "st-chan", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;
            await cache.put(testDbName, "users", { id: ST_USER_ID }, user);

            await client
                .db(testDbName)
                .collection("arenaPlayers")
                .insertOne({ allyCode: ST_ALLY_CODE, name: "Hydrated", lastCharRank: 7, lastShipRank: 3 });

            await stFuncs.shardTimes();

            assert.strictEqual(sentPayloads.length, 1, "expected exactly one payout message");
            const field = sentPayloads[0]?.embeds?.[0]?.fields?.[0];
            assert.ok(field, "expected a payout field in the embed");
            assert.ok(field.value.includes("Hydrated"), `expected hydrated name, got: ${field.value}`);
            assert.ok(field.value.includes("7"), `expected hydrated char rank, got: ${field.value}`);
        });

        it("persists the payout msgID without clobbering markers arenaTick wrote meanwhile", async () => {
            // shardTimes (5-minute interval) and arenaTick (1-minute interval) run on separate
            // timers and each load their own copy of the user doc. shardTimes only ever needs to
            // save the payout msgIDs, so its write must not carry a stale arenaWatch subtree back
            // over the per-cycle alert markers arenaTick persisted after shardTimes loaded -
            // rolling those back re-fires the payout warn/result that was already sent.
            const patron: ActivePatron = { discordID: ST_USER_ID, amount_cents: 100 };
            await cache.put(testDbName, "patrons", { discordID: ST_USER_ID }, patron);

            const user = {
                id: ST_USER_ID,
                accounts: [],
                arenaWatch: {
                    allyCodes: [{ allyCode: ST_ALLY_CODE, mention: null, poOffset: 0 }],
                    arena: { char: { channel: null, enabled: false }, fleet: { channel: null, enabled: false } },
                    payout: {
                        char: { enabled: true, channel: "st-chan", msgID: null },
                        fleet: { enabled: false, channel: null, msgID: null },
                    },
                },
            } as unknown as UserConfig;
            await cache.put(testDbName, "users", { id: ST_USER_ID }, user);

            // Land arenaTick's write in the gap between shardTimes' read and its own write
            onSend = async () => {
                await client
                    .db(testDbName)
                    .collection("users")
                    .updateOne(
                        { id: ST_USER_ID },
                        {
                            $set: {
                                "arenaWatch.allyCodes.0.alerted": { charWarn: 1234, charResult: 5678 },
                                "arenaWatch.allyCodes.0.lastCharAnnounced": 12,
                            },
                        },
                    );
            };

            await stFuncs.shardTimes();

            const saved = (await client.db(testDbName).collection("users").findOne({ id: ST_USER_ID })) as unknown as UserConfig | null;
            const entry = saved?.arenaWatch?.allyCodes?.[0];
            assert.deepStrictEqual(
                entry?.alerted,
                { charWarn: 1234, charResult: 5678 },
                "shardTimes must not roll back the payout markers arenaTick wrote",
            );
            assert.strictEqual(entry?.lastCharAnnounced, 12, "shardTimes must not roll back the last-announced rank");
            assert.strictEqual(saved?.arenaWatch?.payout?.char?.msgID, "st-msg-1", "shardTimes must still persist the payout msgID");
        });
    });
});

describe("updateArenaHistory()", () => {
    it("creates a new entry from undefined input", () => {
        const result = updateArenaHistory(undefined, 42);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].rank, 42);
        assert.ok(typeof result[0].ts === "number");
    });

    it("pushes a new entry onto an existing array", () => {
        const existing = [{ rank: 10, ts: 1000 }];
        const result = updateArenaHistory(existing, 8);
        assert.strictEqual(result.length, 2);
    });

    it("does not mutate the input array", () => {
        const existing = [{ rank: 10, ts: 1000 }];
        updateArenaHistory(existing, 8);
        assert.strictEqual(existing.length, 1);
    });

    it("sorts entries by timestamp ascending", () => {
        // existing entries have small ts values; new entry gets Date.now() which is far larger
        const existing = [
            { rank: 5, ts: 3000 },
            { rank: 3, ts: 1000 },
        ];
        const result = updateArenaHistory(existing, 7);
        assert.strictEqual(result.length, 3);
        assert.ok(result[0].ts <= result[1].ts);
        assert.ok(result[1].ts <= result[2].ts);
        assert.strictEqual(result[2].rank, 7); // new entry has largest ts so lands last
    });

    it("caps at 90 entries by shifting the oldest", () => {
        // ts values 1..90 are far in the past; new entry gets Date.now() so it lands last
        const existing = Array.from({ length: 90 }, (_, i) => ({ rank: i + 1, ts: i + 1 }));
        const result = updateArenaHistory(existing, 99);
        assert.strictEqual(result.length, 90);
        assert.ok(result.every((e) => e.ts !== 1)); // ts=1 (oldest) was shifted off
        assert.strictEqual(result[0].ts, 2); // ts=2 is now the oldest
        assert.ok(result.some((e) => e.rank === 99));
    });

    it("keeps 90 entries when input has exactly 89", () => {
        const existing = Array.from({ length: 89 }, (_, i) => ({ rank: i + 1, ts: i + 1 }));
        const result = updateArenaHistory(existing, 99);
        assert.strictEqual(result.length, 90);
    });

    it("handles an empty array input", () => {
        const result = updateArenaHistory([], 15);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].rank, 15);
    });
});

describe("shouldWriteHistory()", () => {
    it("returns true for undefined input (no history yet)", () => {
        assert.strictEqual(shouldWriteHistory(undefined), true);
    });

    it("returns true for empty array", () => {
        assert.strictEqual(shouldWriteHistory([]), true);
    });

    it("returns true when last entry is older than 5 minutes", () => {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        assert.strictEqual(shouldWriteHistory([{ rank: 5, ts: tenMinutesAgo }]), true);
    });

    it("returns false when last entry is within the 5-minute dedup window", () => {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        assert.strictEqual(shouldWriteHistory([{ rank: 5, ts: oneMinuteAgo }]), false);
    });

    it("reads the last entry (newest) not an arbitrary element", () => {
        // Array sorted ascending by ts: last element is newest.
        // If shouldWriteHistory correctly uses at(-1), it sees the recent entry and returns false.
        // If it used at(0) by mistake, it would see the old entry and return true.
        const old = { rank: 3, ts: 1 };
        const recent = { rank: 5, ts: Date.now() - 60 * 1000 };
        assert.strictEqual(shouldWriteHistory([old, recent]), false);
    });
});

describe("hydrateWatchAccounts()", () => {
    it("merges name and ranks from arenaPlayers docs onto watch entries", () => {
        const entries = [{ allyCode: 111, mention: null, poOffset: 60 } as ArenaWatchConfig];
        const playerMap = new Map<number, ArenaPlayer>([
            [111, { allyCode: 111, name: "Merged", lastCharRank: 4, lastShipRank: 9 }],
        ]);
        const result = hydrateWatchAccounts(entries, playerMap);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, "Merged");
        assert.strictEqual(result[0].lastChar, 4);
        assert.strictEqual(result[0].lastShip, 9);
        assert.strictEqual(result[0].poOffset, 60);
    });

    it("falls back to the ally code as name and null ranks when no doc exists", () => {
        const entries = [{ allyCode: 222, mention: null, poOffset: 0 } as ArenaWatchConfig];
        const result = hydrateWatchAccounts(entries, new Map());
        assert.strictEqual(result[0].name, "222");
        assert.strictEqual(result[0].lastChar, null);
        assert.strictEqual(result[0].lastShip, null);
    });

    it("does not mutate the input entries", () => {
        const entry = { allyCode: 333, mention: null, poOffset: 0 } as ArenaWatchConfig;
        hydrateWatchAccounts([entry], new Map());
        assert.deepStrictEqual(entry, { allyCode: 333, mention: null, poOffset: 0 });
    });
});

describe("collectAllyCodes()", () => {
    it("returns empty array when no eligible patrons (below tier 1)", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 50 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", { id: "u1", accounts: [111], primaryAllyCode: 111 } as UserConfig],
        ]);
        assert.deepStrictEqual(collectAllyCodes(patrons, userMap), []);
    });

    it("collects ally codes from user.accounts for eligible patrons", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [111, 222],
                primaryAllyCode: 111,
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.length, 2);
        assert.ok(result.includes(111));
        assert.ok(result.includes(222));
    });

    it("collects ally codes from arenaWatch.allyCodes", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [],
                arenaWatch: { allyCodes: [{ allyCode: 333, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.ok(result.includes(333));
    });

    it("deduplicates a code that appears in both accounts and arenaWatch", () => {
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [111], primaryAllyCode: 111,
                arenaWatch: { allyCodes: [{ allyCode: 111, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.filter((c) => c === 111).length, 1);
    });

    it("deduplicates a code watched by two different patrons", () => {
        const patrons: ActivePatron[] = [
            { discordID: "u1", amount_cents: 100 },
            { discordID: "u2", amount_cents: 100 },
        ];
        const userMap = new Map<string, UserConfig>([
            ["u1", { id: "u1", accounts: [555], primaryAllyCode: 555 } as UserConfig],
            ["u2", { id: "u2", accounts: [], arenaWatch: { allyCodes: [{ allyCode: 555, mention: null, poOffset: 0 } satisfies ArenaWatchConfig] } } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.strictEqual(result.filter((c) => c === 555).length, 1);
    });

    it("only collects arenaWatch codes within the patron's tier account limit", () => {
        // $1 tier => arenaWatchConfig.tier1 (1) watched account; the rest are never
        // processed, so fetching their game data every tick is wasted work
        const patrons: ActivePatron[] = [{ discordID: "u1", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>([
            ["u1", {
                id: "u1",
                accounts: [],
                arenaWatch: {
                    allyCodes: [
                        { allyCode: 331, mention: null, poOffset: 0 },
                        { allyCode: 332, mention: null, poOffset: 0 },
                        { allyCode: 333, mention: null, poOffset: 0 },
                    ],
                },
            } as UserConfig],
        ]);
        const result = collectAllyCodes(patrons, userMap);
        assert.deepStrictEqual(result, [331], "codes past the tier limit must not be collected");
    });

    it("skips patrons with no user record in the map", () => {
        const patrons: ActivePatron[] = [{ discordID: "ghost", amount_cents: 100 }];
        const userMap = new Map<string, UserConfig>();
        assert.deepStrictEqual(collectAllyCodes(patrons, userMap), []);
    });
});

describe("payoutCycleInfo()", () => {
    const now = 1_000_000_000_000;
    const { dayMS, minMS } = constants;

    it("derives minTil by flooring the minutes until payout", () => {
        assert.strictEqual(payoutCycleInfo(now, 30 * minMS).minTil, 30);
        assert.strictEqual(payoutCycleInfo(now, 90 * 1000).minTil, 1, "90s floors to 1 minute");
        assert.strictEqual(payoutCycleInfo(now, 0).minTil, 0);
    });

    it("reports the upcoming and just-passed payout instants", () => {
        const info = payoutCycleInfo(now, 30 * minMS);
        assert.strictEqual(info.nextPayout, now + 30 * minMS, "nextPayout is now + timeLeft");
        assert.strictEqual(info.lastPayout, now + 30 * minMS - dayMS, "lastPayout is one cycle before nextPayout");
    });

    it("flags justAfterPayout only within the window following payout", () => {
        // timeLeft near a full day == payout just happened
        assert.strictEqual(payoutCycleInfo(now, dayMS - 2 * minMS).justAfterPayout, true, "2 min after payout is inside the window");
        assert.strictEqual(payoutCycleInfo(now, dayMS - 5 * minMS).justAfterPayout, true, "exactly at the window edge counts");
        assert.strictEqual(payoutCycleInfo(now, dayMS - 6 * minMS).justAfterPayout, false, "past the window does not");
        // small timeLeft == payout is still upcoming, not just after
        assert.strictEqual(payoutCycleInfo(now, 30 * minMS).justAfterPayout, false, "before payout is never justAfter");
    });
});

// Separates "the send broke, try again" from "this target refuses the message as a matter of
// configuration". Only the latter may close out an alert cycle without the message landing.
describe("classifySendError()", () => {
    it("treats blocked DMs and missing permissions as undeliverable", () => {
        for (const code of [10003, 10013, 50001, 50007, 50013]) {
            assert.strictEqual(
                classifySendError(Object.assign(new Error("nope"), { code })),
                "undeliverable",
                `Discord code ${code} cannot succeed on a retry`,
            );
        }
    });

    it("treats an error with no Discord code as transient", () => {
        assert.strictEqual(classifySendError(new Error("socket hang up")), "failed");
        assert.strictEqual(classifySendError("some string"), "failed");
        assert.strictEqual(classifySendError(null), "failed");
    });

    it("treats an unrecognised Discord code as transient", () => {
        // 500xx is a broad space; only the codes we have reasoned about may suppress a retry
        assert.strictEqual(classifySendError(Object.assign(new Error("boom"), { code: 50035 })), "failed");
    });

    it("does not treat a string code as a Discord error code", () => {
        // Node network errors use string codes (ECONNRESET); those are transient
        assert.strictEqual(classifySendError(Object.assign(new Error("reset"), { code: "ECONNRESET" })), "failed");
    });
});

describe("isInWarnWindow()", () => {
    it("fires at the configured warn minute", () => {
        assert.strictEqual(isInWarnWindow(30, 30), true);
    });

    it("catches up a few missed minutes so a dropped tick still warns", () => {
        assert.strictEqual(isInWarnWindow(29, 30), true, "one missed tick still warns");
        assert.strictEqual(isInWarnWindow(26, 30), true, "the far edge of the catch-up window still warns");
    });

    it("does not fire arbitrarily late after a long gap", () => {
        // The bound is what stops an outage (or a watcher with no marker yet) from firing
        // "your payout is in 5 minutes" as the 30-minute warning at whatever minute we came back on
        assert.strictEqual(isInWarnWindow(25, 30), false, "past the catch-up window is too stale to warn");
        assert.strictEqual(isInWarnWindow(5, 30), false);
    });

    it("never fires before the warn minute or after payout", () => {
        assert.strictEqual(isInWarnWindow(31, 30), false, "too early");
        assert.strictEqual(isInWarnWindow(0, 30), false, "payout has passed");
    });

    it("treats a disabled/unset warn minute as off", () => {
        assert.strictEqual(isInWarnWindow(10, 0), false);
        assert.strictEqual(isInWarnWindow(10, undefined), false);
    });

    it("clamps the catch-up window at payout for warn minutes shorter than it", () => {
        assert.strictEqual(isInWarnWindow(3, 3), true);
        assert.strictEqual(isInWarnWindow(1, 3), true, "still before payout, so still warnable");
        assert.strictEqual(isInWarnWindow(0, 3), false, "payout has passed");
    });
});
