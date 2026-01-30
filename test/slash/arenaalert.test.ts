import assert from "node:assert";
import { describe, it } from "node:test";
import ArenaAlert from "../../slash/arenaalert.ts";
import { createMockBot } from "../mocks/index.ts";
import type { UserConfig } from "../../types/types.ts";

describe("ArenaAlert", () => {
    // Helper to create a base user config for testing
    function createBaseUser(): UserConfig {
        return {
            id: "123456789",
            accounts: [],
            arenaAlert: {
                enableRankDMs: "off",
                arena: "char",
                payoutResult: "off",
                payoutWarning: 0,
            },
        } as UserConfig;
    }

    describe("Functionality Tests", () => {
        it("should update enabledms setting and generate changelog", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutResult: "on",
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutResult, "on");
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Payout Result"));
            assert.ok(result.changelog[0].includes("off"));
            assert.ok(result.changelog[0].includes("on"));
        });

        it("should update payout warning with valid value", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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

        it("should reject payout warning value that is too low", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutWarning: -5,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 0);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Cannot change"));
            assert.ok(result.changelog[0].includes("-5"));
        });

        it("should reject payout warning value that is too high", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                payoutWarning: 1500,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 0);
            assert.strictEqual(result.changelog.length, 1);
            assert.ok(result.changelog[0].includes("Cannot change"));
            assert.ok(result.changelog[0].includes("1500"));
        });

        it("should accept maximum valid payout warning value (1439)", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
            const user = createBaseUser();

            const result = (command as any).computeArenaAlertChanges(user, {
                enabledms: "primary",
                arena: "both",
                payoutResult: "on",
                payoutWarning: 60,
            });

            assert.strictEqual(result.updatedUser.arenaAlert.enableRankDMs, "primary");
            assert.strictEqual(result.updatedUser.arenaAlert.arena, "both");
            assert.strictEqual(result.updatedUser.arenaAlert.payoutResult, "on");
            assert.strictEqual(result.updatedUser.arenaAlert.payoutWarning, 60);
            assert.strictEqual(result.changelog.length, 4);
        });

        it("should not generate changelog when no changes are made", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
            const user = createBaseUser();
            const originalEnableDMs = user.arenaAlert.enableRankDMs;

            (command as any).computeArenaAlertChanges(user, {
                enabledms: "all",
            });

            assert.strictEqual(user.arenaAlert.enableRankDMs, originalEnableDMs);
        });

        it("should set payout warning to 0 to disable it", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);
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
    });

    describe("Command Configuration", () => {
        it("should work without guild context (guildOnly: false)", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

            assert.strictEqual(command.commandData.guildOnly, false);
        });

        it("should be enabled", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

            assert.strictEqual(command.commandData.enabled, true);
        });

        it("should have correct command name", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

            assert.strictEqual(command.commandData.name, "arenaalert");
        });

        it("should have enabledms option with all, primary, and off choices", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

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
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

            const payoutResultOpt = command.commandData.options.find((o) => o.name === "payout_result");
            assert.ok(payoutResultOpt);
            assert.ok(payoutResultOpt.choices);
            assert.strictEqual(payoutResultOpt.choices.length, 2);
            const values = payoutResultOpt.choices.map((c) => c.value);
            assert.ok(values.includes("on"));
            assert.ok(values.includes("off"));
        });

        it("should have payout_warning option with min/max values", () => {
            const bot = createMockBot();
            const command = new ArenaAlert(bot);

            const payoutWarningOpt = command.commandData.options.find((o) => o.name === "payout_warning");
            assert.ok(payoutWarningOpt);
            assert.strictEqual(payoutWarningOpt.minValue, 0);
            assert.strictEqual(payoutWarningOpt.maxValue, 1440);
        });
    });
});
