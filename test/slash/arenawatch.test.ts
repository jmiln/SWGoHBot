import assert from "node:assert";
import { describe, it } from "node:test";
import ArenaWatch, { fillAWSkeleton, processAWChanges } from "../../slash/arenawatch.ts";
import { createMockBot } from "../mocks/index.ts";
import type { UserConfig } from "../../types/types.ts";

describe("ArenaWatch", () => {
    // Helper to create a base arena watch config
    function createBaseAW(): UserConfig["arenaWatch"] {
        return {
            enabled: false,
            allycodes: [],
            channel: null,
            arena: {
                fleet: {
                    channel: null,
                    enabled: false,
                },
                char: {
                    channel: null,
                    enabled: false,
                },
            },
            payout: {
                char: {
                    enabled: false,
                    channel: null,
                    msgID: null,
                },
                fleet: {
                    enabled: false,
                    channel: null,
                    msgID: null,
                },
            },
            useMarksInLog: false,
            report: "both",
            showvs: true,
        };
    }

    describe("Functionality Tests", () => {
        describe("fillAWSkeleton", () => {
            it("should fill in missing payout structure", () => {
                const aw = { enabled: true, allycodes: [] } as UserConfig["arenaWatch"];
                const filled = fillAWSkeleton(aw);

                assert.ok(filled.payout);
                assert.ok(filled.payout.char);
                assert.ok(filled.payout.fleet);
                assert.strictEqual(filled.payout.char.enabled, false);
                assert.strictEqual(filled.payout.fleet.enabled, false);
            });

            it("should set default values for useMarksInLog, report, and showvs", () => {
                const aw = { enabled: true, allycodes: [] } as UserConfig["arenaWatch"];
                const filled = fillAWSkeleton(aw);

                assert.strictEqual(filled.useMarksInLog, false);
                assert.strictEqual(filled.report, "both");
                assert.strictEqual(filled.showvs, true);
            });

            it("should migrate old channel setting to arena structure", () => {
                const aw = {
                    enabled: true,
                    allycodes: [],
                    channel: "12345",
                    report: "both",
                    arena: {},
                } as UserConfig["arenaWatch"];
                const filled = fillAWSkeleton(aw);

                assert.strictEqual(filled.arena.char.channel, "12345");
                assert.strictEqual(filled.arena.fleet.channel, "12345");
                assert.strictEqual(filled.arena.char.enabled, true);
                assert.strictEqual(filled.arena.fleet.enabled, true);
            });

            it("should handle null input gracefully", () => {
                const filled = fillAWSkeleton(null);

                assert.ok(filled);
                assert.strictEqual(filled.enabled, false);
                assert.ok(Array.isArray(filled.allycodes));
            });
        });

        describe("enabled subcommand", () => {
            it("should enable arenawatch", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "enabled",
                    interactionOptions: { toggle: true } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.enabled, true);
                assert.ok(result.outLog.includes("enabled"));
            });

            it("should disable arenawatch", async () => {
                const aw = createBaseAW();
                aw.enabled = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "enabled",
                    interactionOptions: { toggle: false } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.enabled, false);
                assert.ok(result.outLog.includes("disabled"));
            });
        });

        describe("arena subcommand", () => {
            it("should enable char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena",
                    interactionOptions: { enabled: true, arena: "char" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.arena.char.enabled, true);
                assert.strictEqual(awRes.arena.fleet.enabled, false);
                assert.ok(result.outLog.includes("char"));
                assert.ok(result.outLog.includes("enabled"));
            });

            it("should enable both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena",
                    interactionOptions: { enabled: true, arena: "both" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.arena.char.enabled, true);
                assert.strictEqual(awRes.arena.fleet.enabled, true);
                assert.ok(result.outLog.includes("both"));
            });

            it("should disable fleet arena", async () => {
                const aw = createBaseAW();
                aw.arena.fleet.enabled = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena",
                    interactionOptions: { enabled: false, arena: "fleet" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.arena.fleet.enabled, false);
                assert.ok(result.outLog.includes("fleet"));
                assert.ok(result.outLog.includes("disabled"));
            });
        });

        describe("channel subcommand", () => {
            it("should set channel for char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "channel",
                    interactionOptions: { channelId: "123456789", arena: "char" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.arena.char.channel, "123456789");
                assert.strictEqual(awRes.arena.fleet.channel, null);
                assert.ok(result.outLog.includes("123456789"));
            });

            it("should set channel for both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "channel",
                    interactionOptions: { channelId: "987654321", arena: "both" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.arena.char.channel, "987654321");
                assert.strictEqual(awRes.arena.fleet.channel, "987654321");
                assert.ok(result.outLog.includes("both arenas"));
            });

            it("should reject invalid channel", async () => {
                const aw = createBaseAW();
                const { result } = await processAWChanges({
                    target: "channel",
                    interactionOptions: { channelId: null, arena: "char" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.ok(result.error);
                assert.ok(result.error.includes("Invalid channel"));
            });
        });

        describe("report subcommand", () => {
            it("should set report to climb", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "report",
                    interactionOptions: { arena: "climb" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.report, "climb");
                assert.ok(result.outLog.includes("climb"));
            });

            it("should set report to drop", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "report",
                    interactionOptions: { arena: "drop" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.report, "drop");
            });

            it("should not change if already set to same value", async () => {
                const aw = createBaseAW();
                aw.report = "both";
                const { result, aw: awRes } = await processAWChanges({
                    target: "report",
                    interactionOptions: { arena: "both" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.report, "both");
                assert.ok(result.outLog.includes("already"));
            });
        });

        describe("showvs subcommand", () => {
            it("should enable showvs", async () => {
                const aw = createBaseAW();
                aw.showvs = false;
                const { result, aw: awRes } = await processAWChanges({
                    target: "showvs",
                    interactionOptions: { enabled: true } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.showvs, true);
                assert.ok(result.outLog.includes("will now show"));
            });

            it("should disable showvs", async () => {
                const aw = createBaseAW();
                aw.showvs = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "showvs",
                    interactionOptions: { enabled: false } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.showvs, false);
                assert.ok(result.outLog.includes("will not show"));
            });

            it("should detect no change when already set", async () => {
                const aw = createBaseAW();
                aw.showvs = true;
                const { result } = await processAWChanges({
                    target: "showvs",
                    interactionOptions: { enabled: true } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.ok(result.outLog.includes("already"));
            });
        });

        describe("use_marks_in_log subcommand", () => {
            it("should enable use_marks_in_log", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "use_marks_in_log",
                    interactionOptions: { enabled: true } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.useMarksInLog, true);
                assert.ok(result.outLog.includes("true"));
            });

            it("should reject no change", async () => {
                const aw = createBaseAW();
                aw.useMarksInLog = false;
                const { result } = await processAWChanges({
                    target: "use_marks_in_log",
                    interactionOptions: { enabled: false } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.ok(result.error);
                assert.ok(result.error.includes("already"));
            });
        });

        describe("payout subcommand group", () => {
            it("should enable payout for char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "enable", enabled: true, arena: "char" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.payout.char.enabled, true);
                assert.strictEqual(awRes.payout.fleet.enabled, false);
                assert.ok(result.outLog.includes("enabled"));
            });

            it("should enable payout for both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "enable", enabled: true, arena: "both" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.payout.char.enabled, true);
                assert.strictEqual(awRes.payout.fleet.enabled, true);
            });

            it("should set payout channel for fleet", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "channel", channelId: "555555555", arena: "fleet" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.payout.fleet.channel, "555555555");
                assert.strictEqual(awRes.payout.char.channel, null);
                assert.ok(result.outLog.includes("555555555"));
            });

            it("should reject invalid payout channel", async () => {
                const aw = createBaseAW();
                const { result } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "channel", channelId: null, arena: "char" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.ok(result.error);
                assert.ok(result.error.includes("Invalid channel"));
            });
        });

        describe("allycode remove subcommand", () => {
            it("should remove an existing allycode", async () => {
                const aw = createBaseAW();
                aw.allycodes = [
                    {
                        allyCode: 123456789,
                        name: "Test Player",
                        mention: null,
                        lastChar: 100,
                        lastShip: 50,
                        poOffset: 0,
                        mark: null,
                    },
                ];

                const { result, aw: awRes } = await processAWChanges({
                    target: "allycode",
                    interactionOptions: { subCommand: "remove", allycodes: "123456789" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.strictEqual(awRes.allycodes.length, 0);
                assert.ok(result.outLog.includes("removed"));
            });

            it("should error when removing non-existent allycode", async () => {
                const aw = createBaseAW();
                const { result } = await processAWChanges({
                    target: "allycode",
                    interactionOptions: { subCommand: "remove", allycodes: "999999999" } as any,
                    aw,
                    unitStats: async () => [],
                });

                assert.ok(result.error);
                assert.ok(result.error.includes("not available"));
            });
        });
    });

    describe("Command Configuration", () => {
        it("should work without guild context (guildOnly: false)", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            assert.strictEqual(command.commandData.guildOnly, false);
        });

        it("should be enabled", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            assert.strictEqual(command.commandData.enabled, true);
        });

        it("should have correct command name", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            assert.strictEqual(command.commandData.name, "arenawatch");
        });

        it("should have allycode subcommand group with add, remove, and edit", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const allycodeGroup = command.commandData.options.find((o) => o.name === "allycode");
            assert.ok(allycodeGroup);
            assert.strictEqual(allycodeGroup.type, 2); // SubcommandGroup

            const addSubcmd = allycodeGroup.options.find((o) => o.name === "add");
            const removeSubcmd = allycodeGroup.options.find((o) => o.name === "remove");
            const editSubcmd = allycodeGroup.options.find((o) => o.name === "edit");

            assert.ok(addSubcmd);
            assert.ok(removeSubcmd);
            assert.ok(editSubcmd);
            assert.strictEqual(addSubcmd.type, 1); // Subcommand
        });

        it("should have payout subcommand group with enable, channel, and mark", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const payoutGroup = command.commandData.options.find((o) => o.name === "payout");
            assert.ok(payoutGroup);
            assert.strictEqual(payoutGroup.type, 2); // SubcommandGroup

            const enableSubcmd = payoutGroup.options.find((o) => o.name === "enable");
            const channelSubcmd = payoutGroup.options.find((o) => o.name === "channel");
            const markSubcmd = payoutGroup.options.find((o) => o.name === "mark");

            assert.ok(enableSubcmd);
            assert.ok(channelSubcmd);
            assert.ok(markSubcmd);
        });

        it("should have all main subcommands", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const subcommands = ["arena", "channel", "enabled", "report", "showvs", "warn", "result", "use_marks_in_log", "view"];

            for (const subcmd of subcommands) {
                const option = command.commandData.options.find((o) => o.name === subcmd);
                assert.ok(option, `Expected ${subcmd} subcommand to exist`);
            }
        });

        it("should have arena choices for arena subcommand", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const arenaSubcmd = command.commandData.options.find((o) => o.name === "arena");
            const arenaOption = arenaSubcmd.options.find((o) => o.name === "arena");

            assert.ok(arenaOption.choices);
            const values = arenaOption.choices.map((c) => c.value);
            assert.ok(values.includes("char"));
            assert.ok(values.includes("fleet"));
            assert.ok(values.includes("both"));
            assert.ok(values.includes("none"));
        });

        it("should have report choices", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const reportSubcmd = command.commandData.options.find((o) => o.name === "report");
            const arenaOption = reportSubcmd.options.find((o) => o.name === "arena");

            assert.ok(arenaOption.choices);
            const values = arenaOption.choices.map((c) => c.value);
            assert.ok(values.includes("climb"));
            assert.ok(values.includes("drop"));
            assert.ok(values.includes("both"));
        });

        it("should have warn subcommand with proper min/max values", () => {
            const bot = createMockBot();
            const command = new ArenaWatch(bot);

            const warnSubcmd = command.commandData.options.find((o) => o.name === "warn");
            const minsOption = warnSubcmd.options.find((o) => o.name === "mins");

            assert.ok(minsOption);
            assert.strictEqual(minsOption.minValue, 0);
            assert.strictEqual(minsOption.maxValue, 1439);
        });
    });
});
