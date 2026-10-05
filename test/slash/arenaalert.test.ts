import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import type { User } from "discord.js";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import userReg from "../../modules/users.ts";
import ArenaAlert from "../../slash/arenaalert.ts";
import type { UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";

describe("ArenaAlert", () => {
    // Helper to create a base user config for testing
    function createBaseUser(): UserConfig {
        return {
            id: "123456789",
            accounts: [],
            arenaAlert: {
                enableRankDMs: "off",
                arena: "char",
                enablePayoutResult: false,
                payoutWarning: 0,
            },
        } as UserConfig;
    }

    describe("Functionality Tests", () => {
        it("should update enabledms setting and generate changelog", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                enabledms: "all",
            });

            assert.strictEqual(result.updatedUser.arenaAlert.enableRankDMs, "all");
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("EnableDMs"));
            assert.ok(result.changelog[0].includes("off"));
            assert.ok(result.changelog[0].includes("all"));
        });

        it("should update arena setting and generate changelog", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                arena: "fleet",
            });

            assert.strictEqual(result.updatedUser.arenaAlert.arena, "fleet");
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("arena"));
            assert.ok(result.changelog[0].includes("char"));
            assert.ok(result.changelog[0].includes("fleet"));
        });

        it("should update payout result setting and generate changelog", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutResult: "on",
            });

            assert.strictEqual(result.updatedUser.arenaAlert.enablePayoutResult, true);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Payout Result"));
            assert.ok(result.changelog[0].includes("OFF"));
            assert.ok(result.changelog[0].includes("ON"));
        });

        it("should update payout warning with valid value", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutWarning: 30,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 30);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Payout Warning"));
            assert.ok(result.changelog[0].includes("0"));
            assert.ok(result.changelog[0].includes("30"));
        });

        it("should accept maximum valid payout warning value (1439)", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutWarning: 1439,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 1439);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Payout Warning"));
            assert.ok(result.changelog[0].includes("1439"));
        });

        it("should handle multiple changes at once", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                enabledms: "primary",
                arena: "both",
                payoutResult: "on",
                payoutWarning: 60,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.enableRankDMs, "primary");
            assert.strictEqual(result.updatedUser.arenaAlert.arena, "both");
            assert.strictEqual(result.updatedUser.arenaAlert.enablePayoutResult, true);
            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 60);
            assert.strictEqual(result.changelog.length, 4);
        });

        it("should not generate changelog when no changes are made", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();
            user.arenaAlert.enableRankDMs = "all";
            user.arenaAlert.arena = "fleet";

            const result = (command as any).computeArenaAlertChanges(user, {
                enabledms: "all",
                arena: "fleet",
            });

            assert.strictEqual(result.updatedUser.arenaAlert.enableRankDMs, "all");
            assert.strictEqual(result.updatedUser.arenaAlert.arena, "fleet");
            assert.strictEqual(result.changelog.length, 0);
        });

        it("should not mutate the original user object", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();
            const originalEnableDMs = user.arenaAlert.enableRankDMs;

            (command as any).computeArenaAlertChanges(user, {
                enabledms: "all",
            });

            assert.strictEqual(user.arenaAlert.enableRankDMs, originalEnableDMs);
        });

        it("should set payout warning to 0 to disable it", () => {
            const command = new ArenaAlert();
            const user = createBaseUser();
            user.arenaAlert.payoutWarning = 30;

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutWarning: 0,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 0);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Payout Warning"));
            assert.ok(result.changelog[0].includes("30"));
            assert.ok(result.changelog[0].includes("0"));
        });

        describe("getArenaAlertWarnings", () => {
            it("should warn when DMs are enabled but no arena is selected", () => {
                const command = new ArenaAlert();

                const warnings = (command as any).getArenaAlertWarnings({
                    enableRankDMs: "all",
                    arena: "none",
                    enablePayoutResult: false,
                    payoutWarning: 0,
                });

                assert.deepStrictEqual(warnings, ["COMMAND_ARENAALERT_WARN_NO_ARENA"]);
            });

            it("should warn when an arena is selected but DMs are off", () => {
                const command = new ArenaAlert();

                const warnings = (command as any).getArenaAlertWarnings({
                    enableRankDMs: "off",
                    arena: "char",
                    enablePayoutResult: false,
                    payoutWarning: 0,
                });

                assert.deepStrictEqual(warnings, ["COMMAND_ARENAALERT_WARN_DMS_OFF"]);
            });

            it("should not warn when both DMs and arena are configured", () => {
                const command = new ArenaAlert();

                const warnings = (command as any).getArenaAlertWarnings({
                    enableRankDMs: "primary",
                    arena: "both",
                    enablePayoutResult: false,
                    payoutWarning: 0,
                });

                assert.deepStrictEqual(warnings, []);
            });

            it("should not warn when both DMs and arena are off", () => {
                const command = new ArenaAlert();

                const warnings = (command as any).getArenaAlertWarnings({
                    enableRankDMs: "off",
                    arena: "none",
                    enablePayoutResult: false,
                    payoutWarning: 0,
                });

                assert.deepStrictEqual(warnings, []);
            });

            it("should not warn after a combined change that makes the config functional", () => {
                const command = new ArenaAlert();
                const user = createBaseUser();
                user.arenaAlert.arena = "none";

                const { updatedUser } = (command as any).computeArenaAlertChanges(user, {
                    enabledms: "all",
                    arena: "fleet",
                });
                const warnings = (command as any).getArenaAlertWarnings(updatedUser.arenaAlert);

                assert.deepStrictEqual(warnings, []);
            });
        });
    });

    describe("Command Configuration", () => {
        it("should be enabled", () => {
            const command = new ArenaAlert();

            assert.strictEqual(command.commandData.enabled, true);
        });

        it("should have correct command name", () => {
            const command = new ArenaAlert();

            assert.strictEqual(command.commandData.name, "arenaalert");
        });

        it("should have enabledms option with all, primary, and off choices", () => {
            const command = new ArenaAlert();

            const enabledmsOpt = command.commandData.options.find((o) => o.name === "enabledms");
            assert.ok(enabledmsOpt);
            assert.ok(enabledmsOpt.choices);
            assert.strictEqual(enabledmsOpt.choices.length, 3);
            const values = enabledmsOpt.choices.map((c) => c.value);
            assert.ok(values.includes("all"));
            assert.ok(values.includes("primary"));
            assert.ok(values.includes("off"));
        });

        it("should have arena option with char, fleet, and both choices", () => {
            const command = new ArenaAlert();

            const arenaOpt = command.commandData.options.find((o) => o.name === "arena");
            assert.ok(arenaOpt);
            assert.ok(arenaOpt.choices);
            assert.strictEqual(arenaOpt.choices.length, 3);
            const values = arenaOpt.choices.map((c) => c.value);
            assert.ok(values.includes("char"));
            assert.ok(values.includes("fleet"));
            assert.ok(values.includes("both"));
        });

        it("should have payout_result option with on and off choices", () => {
            const command = new ArenaAlert();

            const payoutResultOpt = command.commandData.options.find((o) => o.name === "payout_result");
            assert.ok(payoutResultOpt);
            assert.ok(payoutResultOpt.choices);
            assert.strictEqual(payoutResultOpt.choices.length, 2);
            const values = payoutResultOpt.choices.map((c) => c.value);
            assert.ok(values.includes("on"));
            assert.ok(values.includes("off"));
        });

        it("should have payout_warning option with min/max values", () => {
            const command = new ArenaAlert();

            const payoutWarningOpt = command.commandData.options.find((o) => o.name === "payout_warning");
            assert.ok(payoutWarningOpt);
            assert.strictEqual(payoutWarningOpt.minValue, 0);
            assert.strictEqual(payoutWarningOpt.maxValue, 1439);
        });
    });

    describe("Saving", () => {
        const SAVE_USER_ID = "arenaalert-save-user";
        let client: MongoClient;
        const users = () => client.db(env.MONGODB_SWGOHBOT_DB).collection("users");

        before(async () => {
            client = await getMongoClient();
            cache.init(client);
            userReg.init(cache);
        });

        after(async () => {
            await users().deleteMany({ id: SAVE_USER_ID });
            await closeMongoClient();
        });

        it("keeps the payout markers arenaTick saves while the command runs", async (t) => {
            await users().insertOne({
                id: SAVE_USER_ID,
                accounts: [111222333],
                arenaAlert: { enableRankDMs: "all", arena: "char", enablePayoutResult: false, payoutWarning: 0 },
            });
            t.mock.method(patreonFuncs, "getPatronUser", async () => ({ discordID: SAVE_USER_ID, amount_cents: 500 }));
            const getOne = cache.getOne.bind(cache);
            t.mock.method(cache, "getOne", async (...args: Parameters<typeof cache.getOne>) => {
                const result = await getOne(...args);
                if (args[1] === "users")
                    await users().updateOne({ id: SAVE_USER_ID }, { $set: { "arenaAlert.alerted.111222333.charWarn": 99 } });
                return result;
            });
            const interaction = createMockInteraction({
                user: { id: SAVE_USER_ID } as User,
                optionsData: { payout_warning: 15 },
            });

            await new ArenaAlert().run(createCommandContext({ interaction }));

            const saved = (await users().findOne({ id: SAVE_USER_ID })) as unknown as UserConfig | null;
            assert.strictEqual(saved?.arenaAlert.payoutWarning, 15, "the command's change is saved");
            assert.deepStrictEqual(saved?.arenaAlert.alerted, { "111222333": { charWarn: 99 } }, "arenaTick's marker survives");
        });
    });
});
