import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import swgohAPI from "../../modules/swapi.ts";
import ArenaWatch, { fillAWSkeleton, processAWChanges } from "../../slash/arenawatch.ts";
import type { UserConfig } from "../../types/types.ts";
import { createMockPlayer, MockSWAPI } from "../mocks/mockSwapi.ts";

describe("ArenaWatch", () => {
    // Helper to create a base arena watch config
    function createBaseAW(): UserConfig["arenaWatch"] {
        return {
            allyCodes: [],
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
                const aw = { allyCodes: [] } as UserConfig["arenaWatch"];
                const filled = fillAWSkeleton(aw);

                assert.ok(filled.payout);
                assert.ok(filled.payout.char);
                assert.ok(filled.payout.fleet);
                assert.strictEqual(filled.payout.char.enabled, false);
                assert.strictEqual(filled.payout.fleet.enabled, false);
            });

            it("should set default values for useMarksInLog, report, and showvs", () => {
                const aw = { allyCodes: [] } as UserConfig["arenaWatch"];
                const filled = fillAWSkeleton(aw);

                assert.strictEqual(filled.useMarksInLog, false);
                assert.strictEqual(filled.report, "both");
                assert.strictEqual(filled.showvs, true);
            });

            it("should migrate old channel setting to arena structure", () => {
                const aw = {
                    allyCodes: [],
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
                assert.ok(Array.isArray(filled.allyCodes));
            });
        });

        describe("arena subcommand", () => {
            it("should enable char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "arena", arenaType: "char" } as any,
                    aw,
                });

                assert.strictEqual(awRes.arena.char.enabled, true);
                assert.strictEqual(awRes.arena.fleet.enabled, false);
                assert.ok(result.outLog.includes("char"));
                assert.ok(result.outLog.includes("enabled"));
            });

            it("should enable both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "arena", arenaType: "both" } as any,
                    aw,
                });

                assert.strictEqual(awRes.arena.char.enabled, true);
                assert.strictEqual(awRes.arena.fleet.enabled, true);
                assert.ok(result.outLog.includes("both"));
            });

            it("should disable all arenas when none is selected", async () => {
                const aw = createBaseAW();
                aw.arena.char.enabled = true;
                aw.arena.fleet.enabled = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "arena", arenaType: "none" } as any,
                    aw,
                });

                assert.strictEqual(awRes.arena.char.enabled, false);
                assert.strictEqual(awRes.arena.fleet.enabled, false);
                assert.ok(result.outLog.includes("disabled"));
            });
        });

        describe("channel subcommand", () => {
            it("should set channel for char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "channel", channelId: "123456789", arena: "char" } as any,
                    aw,

                });

                assert.strictEqual(awRes.arena.char.channel, "123456789");
                assert.strictEqual(awRes.arena.fleet.channel, null);
                assert.ok(result.outLog.includes("123456789"));
            });

            it("should set channel for both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "channel", channelId: "987654321", arena: "both" } as any,
                    aw,

                });

                assert.strictEqual(awRes.arena.char.channel, "987654321");
                assert.strictEqual(awRes.arena.fleet.channel, "987654321");
                assert.ok(result.outLog.includes("both arenas"));
            });

            it("should reject invalid channel", async () => {
                const aw = createBaseAW();
                const { result } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "channel", channelId: null, arena: "char" } as any,
                    aw,

                });

                assert.ok(result.error);
                assert.ok(result.error.includes("Invalid channel"));
            });
        });

        describe("report subcommand", () => {
            it("should set report to climb", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "report", arena: "climb" } as any,
                    aw,

                });

                assert.strictEqual(awRes.report, "climb");
                assert.ok(result.outLog.includes("climb"));
            });

            it("should set report to drop", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "report", arena: "drop" } as any,
                    aw,

                });

                assert.strictEqual(awRes.report, "drop");
            });

            it("should not change if already set to same value", async () => {
                const aw = createBaseAW();
                aw.report = "both";
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "report", arena: "both" } as any,
                    aw,

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
                    target: "arena_log",
                    interactionOptions: { subCommand: "showvs", enabled: true } as any,
                    aw,

                });

                assert.strictEqual(awRes.showvs, true);
                assert.ok(result.outLog.includes("will now show"));
            });

            it("should disable showvs", async () => {
                const aw = createBaseAW();
                aw.showvs = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "showvs", enabled: false } as any,
                    aw,

                });

                assert.strictEqual(awRes.showvs, false);
                assert.ok(result.outLog.includes("will not show"));
            });

            it("should detect no change when already set", async () => {
                const aw = createBaseAW();
                aw.showvs = true;
                const { result } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "showvs", enabled: true } as any,
                    aw,

                });

                assert.ok(result.outLog.includes("already"));
            });
        });

        describe("use_marks_in_log subcommand", () => {
            it("should enable use_marks_in_log", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "use_marks_in_log", enabled: true } as any,
                    aw,

                });

                assert.strictEqual(awRes.useMarksInLog, true);
                assert.ok(result.outLog.includes("true"));
            });

            it("should notify when no change", async () => {
                const aw = createBaseAW();
                aw.useMarksInLog = false;
                const { result } = await processAWChanges({
                    target: "arena_log",
                    interactionOptions: { subCommand: "use_marks_in_log", enabled: false } as any,
                    aw,

                });

                assert.ok(result.outLog);
                assert.ok(result.outLog.includes("already"));
            });
        });

        describe("payout subcommand group", () => {
            it("should enable payout for char arena", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "arena", arenaType: "char" } as any,
                    aw,
                });

                assert.strictEqual(awRes.payout.char.enabled, true);
                assert.strictEqual(awRes.payout.fleet.enabled, false);
                assert.ok(result.outLog.includes("enabled"));
            });

            it("should enable payout for both arenas", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "arena", arenaType: "both" } as any,
                    aw,
                });

                assert.strictEqual(awRes.payout.char.enabled, true);
                assert.strictEqual(awRes.payout.fleet.enabled, true);
            });

            it("should disable payout when none is selected", async () => {
                const aw = createBaseAW();
                aw.payout.char.enabled = true;
                aw.payout.fleet.enabled = true;
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "arena", arenaType: "none" } as any,
                    aw,
                });

                assert.strictEqual(awRes.payout.char.enabled, false);
                assert.strictEqual(awRes.payout.fleet.enabled, false);
                assert.ok(result.outLog.includes("disabled"));
            });

            it("should set payout channel for fleet", async () => {
                const aw = createBaseAW();
                const { result, aw: awRes } = await processAWChanges({
                    target: "payout",
                    interactionOptions: { subCommand: "channel", channelId: "555555555", arena: "fleet" } as any,
                    aw,

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

                });

                assert.ok(result.error);
                assert.ok(result.error.includes("Invalid channel"));
            });
        });

        describe("allyCode remove subcommand", () => {
            it("should remove an existing allyCode", async () => {
                const aw = createBaseAW();
                aw.allyCodes = [
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
                    interactionOptions: { subCommand: "remove", allyCodes: "123456789" } as any,
                    aw,

                });

                assert.strictEqual(awRes.allyCodes.length, 0);
                assert.ok(result.outLog.includes("removed"));
            });

            it("should error when removing non-existent allyCode", async () => {
                const aw = createBaseAW();
                const { result } = await processAWChanges({
                    target: "allycode",
                    interactionOptions: { subCommand: "remove", allyCodes: "999999999" } as any,
                    aw,

                });

                assert.ok(result.error);
                assert.ok(result.error.includes("not available"));
            });
        });
    });

    describe("allycode add/edit subcommand (uses swgohAPI singleton)", () => {
        let mockSwapi: MockSWAPI;
        const originalUnitStats = swgohAPI.unitStats;

        beforeEach(() => {
            mockSwapi = new MockSWAPI();
            (swgohAPI as any).unitStats = mockSwapi.unitStats.bind(mockSwapi);
        });

        afterEach(() => {
            swgohAPI.unitStats = originalUnitStats;
        });

        it("should add a valid ally code and populate player data", async () => {
            const player = createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                arena: { char: { rank: 50, squad: [] }, ship: { rank: 25, squad: [] } },
                poUTCOffsetMinutes: -300,
            });
            mockSwapi.setPlayerData(player);

            const aw = createBaseAW();
            const { result, aw: awRes } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "123456789", codeCap: 5 } as any,
                aw,
            });

            assert.strictEqual(awRes.allyCodes.length, 1);
            assert.strictEqual(awRes.allyCodes[0].allyCode, 123456789);
            assert.strictEqual(awRes.allyCodes[0].name, "TestPlayer");
            assert.strictEqual(awRes.allyCodes[0].lastChar, 50);
            assert.strictEqual(awRes.allyCodes[0].lastShip, 25);
            assert.strictEqual(awRes.allyCodes[0].poOffset, -300);
            assert.ok(result.outLog.includes("added!"));
        });

        it("should store the mark when one is provided", async () => {
            const player = createMockPlayer({ allyCode: 123456789, name: "TestPlayer" });
            mockSwapi.setPlayerData(player);

            const aw = createBaseAW();
            const { aw: awRes } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "123456789", mark: "⭐", codeCap: 5 } as any,
                aw,
            });

            assert.strictEqual(awRes.allyCodes[0].mark, "⭐");
        });

        it("should error when API returns no players for the ally code", async () => {
            // No player data set — unitStats returns empty array
            const aw = createBaseAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "123456789", codeCap: 5 } as any,
                aw,
            });

            assert.ok(result.error, "Expected an error when API returns no players");
            assert.ok(result.error.includes("none of the ally code(s)"));
        });

        it("should error when ally code is already in the list", async () => {
            const player = createMockPlayer({ allyCode: 123456789, name: "TestPlayer" });
            mockSwapi.setPlayerData(player);

            const aw = createBaseAW();
            aw.allyCodes.push({
                allyCode: 123456789,
                name: "TestPlayer",
                mention: null,
                lastChar: 100,
                lastShip: 50,
                poOffset: 0,
                mark: null,
            });

            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "123456789", codeCap: 5 } as any,
                aw,
            });

            assert.ok(result.outLog.includes("already in the list"));
        });

        it("should error when codeCap is reached", async () => {
            const player = createMockPlayer({ allyCode: 123456789, name: "TestPlayer" });
            mockSwapi.setPlayerData(player);

            const aw = createBaseAW();
            aw.allyCodes.push({
                allyCode: 987654321,
                name: "ExistingPlayer",
                mention: null,
                lastChar: 100,
                lastShip: 50,
                poOffset: 0,
                mark: null,
            });

            // codeCap of 1 means the slot is already taken
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "123456789", codeCap: 1 } as any,
                aw,
            });

            assert.ok(result.outLog.includes("cap reached"));
        });

        it("should reject an invalid ally code format", async () => {
            const aw = createBaseAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "not-a-code", codeCap: 5 } as any,
                aw,
            });

            // Invalid code is reported in outLog, no players added, then errors because no valid codes
            assert.ok(result.error, "Expected an error for invalid ally code format");
        });

        it("should add multiple comma-separated ally codes", async () => {
            const player1 = createMockPlayer({ allyCode: 111111111, name: "Player1" });
            const player2 = createMockPlayer({ allyCode: 222222222, name: "Player2" });
            mockSwapi.setPlayerData(player1);
            mockSwapi.setPlayerData(player2);

            const aw = createBaseAW();
            const { result, aw: awRes } = await processAWChanges({
                target: "allycode",
                interactionOptions: { subCommand: "add", allyCodes: "111111111, 222222222", codeCap: 5 } as any,
                aw,
            });

            assert.strictEqual(awRes.allyCodes.length, 2);
            assert.ok(result.outLog.includes("111111111 added!"));
            assert.ok(result.outLog.includes("222222222 added!"));
        });

        it("should edit an existing ally code and update player data", async () => {
            const updatedPlayer = createMockPlayer({
                allyCode: 999888777,
                name: "UpdatedPlayer",
                arena: { char: { rank: 10, squad: [] }, ship: { rank: 5, squad: [] } },
                poUTCOffsetMinutes: 60,
            });
            mockSwapi.setPlayerData(updatedPlayer);

            const aw = createBaseAW();
            aw.allyCodes.push({
                allyCode: 123456789,
                name: "OldPlayer",
                mention: null,
                lastChar: 100,
                lastShip: 50,
                poOffset: 0,
                mark: null,
            });

            const { result, aw: awRes } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "edit",
                    old_allyCode: "123456789",
                    new_allyCode: "999888777",
                    codeCap: 5,
                } as any,
                aw,
            });

            assert.strictEqual(awRes.allyCodes.length, 1);
            assert.strictEqual(awRes.allyCodes[0].allyCode, 999888777);
            assert.strictEqual(awRes.allyCodes[0].name, "UpdatedPlayer");
            assert.ok(result.outLog.includes("updated"));
        });

        it("should error when editing a code not in the list", async () => {
            const aw = createBaseAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "edit",
                    old_allyCode: "123456789",
                    new_allyCode: "987654321",
                    codeCap: 5,
                } as any,
                aw,
            });

            assert.ok(result.error);
            assert.ok(result.error.includes("not in the list"));
        });
    });

    describe("Command Configuration", () => {
        it("should be enabled", () => {
            const command = new ArenaWatch();

            assert.strictEqual(command.commandData.enabled, true);
        });

        it("should have correct command name", () => {
            const command = new ArenaWatch();

            assert.strictEqual(command.commandData.name, "arenawatch");
        });

        it("should have allyCode subcommand group with add, remove, and edit", () => {
            const command = new ArenaWatch();

            const allyCodeGroup = command.commandData.options.find((o) => o.name === "allycode");
            assert.ok(allyCodeGroup);
            assert.strictEqual(allyCodeGroup.type, 2); // SubcommandGroup

            const addSubcmd = allyCodeGroup.options.find((o) => o.name === "add");
            const removeSubcmd = allyCodeGroup.options.find((o) => o.name === "remove");
            const editSubcmd = allyCodeGroup.options.find((o) => o.name === "edit");

            assert.ok(addSubcmd);
            assert.ok(removeSubcmd);
            assert.ok(editSubcmd);
            assert.strictEqual(addSubcmd.type, 1); // Subcommand
        });

        it("should have payout subcommand group with arena, channel, and mark", () => {
            const command = new ArenaWatch();

            const payoutGroup = command.commandData.options.find((o) => o.name === "payout");
            assert.ok(payoutGroup);
            assert.strictEqual(payoutGroup.type, 2); // SubcommandGroup

            const arenaSubcmd = payoutGroup.options.find((o) => o.name === "arena");
            const channelSubcmd = payoutGroup.options.find((o) => o.name === "channel");
            const markSubcmd = payoutGroup.options.find((o) => o.name === "mark");

            assert.ok(arenaSubcmd);
            assert.ok(channelSubcmd);
            assert.ok(markSubcmd);
        });

        it("should have arena_log subcommand group with expected subcommands", () => {
            const command = new ArenaWatch();

            const arenaLogGroup = command.commandData.options.find((o) => o.name === "arena_log");
            assert.ok(arenaLogGroup, "Expected arena_log group to exist");
            assert.strictEqual(arenaLogGroup.type, 2); // SubcommandGroup

            const expectedSubcmds = ["arena", "channel", "warn", "report", "showvs", "result", "use_marks_in_log"];
            for (const name of expectedSubcmds) {
                const sub = arenaLogGroup.options.find((o) => o.name === name);
                assert.ok(sub, `Expected arena_log.${name} subcommand to exist`);
            }
        });

        it("should have view subcommand at top level", () => {
            const command = new ArenaWatch();
            const view = command.commandData.options.find((o) => o.name === "view");
            assert.ok(view, "Expected view subcommand at top level");
            assert.strictEqual(view.type, 1); // Subcommand
        });

        it("should not have enabled, arena, channel, report, showvs, warn, result, use_marks_in_log at top level", () => {
            const command = new ArenaWatch();
            const removed = ["enabled", "arena", "channel", "report", "showvs", "warn", "result", "use_marks_in_log"];
            for (const name of removed) {
                const opt = command.commandData.options.find((o) => o.name === name);
                assert.strictEqual(opt, undefined, `Expected ${name} to not exist at top level`);
            }
        });

        it("should have arena choices for arena_log arena subcommand", () => {
            const command = new ArenaWatch();

            const arenaLogGroup = command.commandData.options.find((o) => o.name === "arena_log");
            const arenaSubcmd = arenaLogGroup.options.find((o) => o.name === "arena");
            const typeOption = arenaSubcmd.options.find((o) => o.name === "type");

            assert.ok(typeOption.choices);
            const values = typeOption.choices.map((c) => c.value);
            assert.ok(values.includes("char"));
            assert.ok(values.includes("fleet"));
            assert.ok(values.includes("both"));
            assert.ok(values.includes("none"));
        });

        it("should have report choices", () => {
            const command = new ArenaWatch();

            const arenaLogGroup = command.commandData.options.find((o) => o.name === "arena_log");
            const reportSubcmd = arenaLogGroup.options.find((o) => o.name === "report");
            const arenaOption = reportSubcmd.options.find((o) => o.name === "arena");

            assert.ok(arenaOption.choices);
            const values = arenaOption.choices.map((c) => c.value);
            assert.ok(values.includes("climb"));
            assert.ok(values.includes("drop"));
            assert.ok(values.includes("both"));
        });

        it("should have warn subcommand with proper min/max values", () => {
            const command = new ArenaWatch();

            const arenaLogGroup = command.commandData.options.find((o) => o.name === "arena_log");
            const warnSubcmd = arenaLogGroup.options.find((o) => o.name === "warn");
            const minsOption = warnSubcmd.options.find((o) => o.name === "mins");

            assert.ok(minsOption);
            assert.strictEqual(minsOption.minValue, 0);
            assert.strictEqual(minsOption.maxValue, 1439);
        });
    });
});
