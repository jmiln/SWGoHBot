import assert from "node:assert/strict";
import test from "node:test";
import ArenaWatch, { processAWChanges, fillAWSkeleton } from "../../slash/arenawatch.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

function getDefaultAW() {
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

function mockUnitStats(players: any[] = []) {
    return async (codes: number | number[]) => {
        if (!players.length) return [];
        return players;
    };
}

// Sample player data for testing
const samplePlayer = {
    allyCode: 123123123,
    name: "TestPlayer",
    arena: {
        char: { rank: 50 },
        ship: { rank: 100 },
    },
    poUTCOffsetMinutes: 300,
};

const samplePlayer2 = {
    allyCode: 456456456,
    name: "TestPlayer2",
    arena: {
        char: { rank: 25 },
        ship: { rank: 75 },
    },
    poUTCOffsetMinutes: -180,
};

test.describe("ArenaWatch Command", () => {
    test.describe("Permission checks", () => {
        test("Should error because the user is not an admin", async () => {
            const bot = createMockBot({});
            const replyCalls: any[] = [];

            const interaction = createMockInteraction({
                user: { id: "456" },
                guild: { id: "123" },
                options: {
                    getSubcommand: () => null,
                    getSubcommandGroup: () => null,
                    getString: () => null,
                    getInteger: () => null,
                },
                reply: async (data) => replyCalls.push(data),
            });
            const cmd = new ArenaWatch(bot);

            await cmd.run(bot, interaction, { level: 0 });
            assert.equal(replyCalls.length, 1);
            assert.equal(replyCalls[0].embeds[0].description, "COMMAND_ARENAWATCH_MISSING_PERM");
        });

        test("Should error because the user is not a patreon", async () => {
            const bot = createMockBot({});
            const replyCalls: any[] = [];

            const interaction = createMockInteraction({
                user: { id: "456" },
                guild: { id: "123" },
                options: {
                    getSubcommand: () => null,
                    getSubcommandGroup: () => null,
                    getString: () => null,
                    getInteger: () => null,
                },
                reply: async (data) => replyCalls.push(data),
            });
            const cmd = new ArenaWatch(bot);

            await cmd.run(bot, interaction, { level: 10 });
            assert.equal(replyCalls.length, 1);
            assert.equal(replyCalls[0].embeds[0].description, "COMMAND_ARENAALERT_PATREON_ONLY");
        });
    });

    test.describe("enabled subcommand", () => {
        test("Should enable arenawatch", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "enabled",
                interactionOptions: { toggle: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.outLog, "ArenaWatch is now enabled.");
            assert.equal(aw.enabled, true);
        });

        test("Should disable arenawatch", async () => {
            const awIn = getDefaultAW();
            awIn.enabled = true;
            const { result, aw } = await processAWChanges({
                target: "enabled",
                interactionOptions: { toggle: false } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.outLog, "ArenaWatch is now disabled.");
            assert.equal(aw.enabled, false);
        });
    });

    test.describe("channel subcommand", () => {
        test("Should set channel for char arena", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "channel",
                interactionOptions: { arena: "char", channelId: "999888777" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.char.channel, "999888777");
            assert.equal(aw.arena.fleet.channel, null);
            assert.match(result.outLog, /char/);
        });

        test("Should set channel for fleet arena", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "channel",
                interactionOptions: { arena: "fleet", channelId: "999888777" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.fleet.channel, "999888777");
            assert.equal(aw.arena.char.channel, null);
            assert.match(result.outLog, /fleet/);
        });

        test("Should set channel for both arenas", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "channel",
                interactionOptions: { arena: "both", channelId: "999888777" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.char.channel, "999888777");
            assert.equal(aw.arena.fleet.channel, "999888777");
            assert.match(result.outLog, /both arenas/);
        });

        test("Should error with invalid channel", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "channel",
                interactionOptions: { arena: "char", channelId: null } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "Invalid channel, please make sure you're choosing a text channel in this server.");
        });
    });

    test.describe("arena subcommand", () => {
        test("Should enable char arena", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "arena",
                interactionOptions: { arena: "char", enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.char.enabled, true);
            assert.equal(aw.arena.fleet.enabled, false);
            assert.match(result.outLog, /char.*enabled/);
        });

        test("Should enable fleet arena", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "arena",
                interactionOptions: { arena: "fleet", enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.fleet.enabled, true);
            assert.equal(aw.arena.char.enabled, false);
            assert.match(result.outLog, /fleet.*enabled/);
        });

        test("Should enable both arenas", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "arena",
                interactionOptions: { arena: "both", enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.char.enabled, true);
            assert.equal(aw.arena.fleet.enabled, true);
            assert.match(result.outLog, /both arenas.*enabled/);
        });

        test("Should disable both arenas with 'none'", async () => {
            const awIn = getDefaultAW();
            awIn.arena.char.enabled = true;
            awIn.arena.fleet.enabled = true;
            const { result, aw } = await processAWChanges({
                target: "arena",
                interactionOptions: { arena: "none", enabled: false } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.arena.char.enabled, false);
            assert.equal(aw.arena.fleet.enabled, false);
        });
    });

    test.describe("allycode add subcommand", () => {
        test("Should add an allycode", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "123-123-123",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer]),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].allyCode, 123123123);
            assert.equal(aw.allycodes[0].name, "TestPlayer");
            assert.match(result.outLog, /added/);
        });

        test("Should add an allycode with a mark", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "123-123-123",
                    mark: "⭐",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer]),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].mark, "⭐");
        });

        test("Should add an allycode with mention", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    // Discord user IDs are 17-19 digits
                    allycodes: "123123123:<@123456789012345678>",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer]),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].mention, "123456789012345678");
        });

        test("Should add multiple allycodes", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "123123123, 456456456",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer, samplePlayer2]),
            });
            assert.equal(aw.allycodes.length, 2);
        });

        test("Should error when allycode cap reached", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 111111111,
                name: "ExistingPlayer",
                mention: null,
                lastChar: 1,
                lastShip: 1,
                poOffset: 0,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "123123123",
                    codeCap: 1,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer]),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.match(result.outLog, /cap reached/);
        });

        test("Should error when no valid allycodes entered", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "invalid",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([]),
            });
            assert.ok(result.outLog.includes("not a valid allycode") || result.error);
        });

        test("Should error when allycode already in list", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "add",
                    allycodes: "123123123",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer]),
            });
            assert.match(result.outLog, /already in the list/);
        });
    });

    test.describe("allycode remove subcommand", () => {
        test("Should remove an allycode", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push(
                { allyCode: 123123123, name: "TestPlayer", mention: null, lastChar: 50, lastShip: 100, poOffset: 300, mark: null },
                { allyCode: 456456456, name: "TestPlayer2", mention: null, lastChar: 25, lastShip: 75, poOffset: -180, mark: null },
            );
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "remove",
                    allycodes: "123123123",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].allyCode, 456456456);
            assert.equal(result.error, null);
        });

        test("Should remove multiple allycodes", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push(
                { allyCode: 123123123, name: "P1", mention: null, lastChar: 50, lastShip: 100, poOffset: 300, mark: null },
                { allyCode: 456456456, name: "P2", mention: null, lastChar: 25, lastShip: 75, poOffset: -180, mark: null },
                { allyCode: 789789789, name: "P3", mention: null, lastChar: 10, lastShip: 50, poOffset: 0, mark: null },
            );
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "remove",
                    allycodes: "123123123, 456456456",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            // Only P3 should remain
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].allyCode, 789789789);
        });

        test("Should successfully remove the last allycode", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "remove",
                    allycodes: "123123123",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            // Should successfully remove with no error
            assert.equal(result.error, null);
            assert.equal(aw.allycodes.length, 0);
        });
    });

    test.describe("allycode edit subcommand", () => {
        test("Should edit an allycode to a new one", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "edit",
                    old_allycode: "123123123",
                    new_allycode: "456456456",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer2]),
            });
            assert.equal(aw.allycodes.length, 1);
            assert.equal(aw.allycodes[0].allyCode, 456456456);
        });

        test("Should error when old allycode not in list", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "edit",
                    old_allycode: "123123123",
                    new_allycode: "456456456",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats([samplePlayer2]),
            });
            assert.equal(result.error, "123123123 is not in the list.");
        });

        test("Should error with invalid old allycode", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "allycode",
                interactionOptions: {
                    subCommand: "edit",
                    old_allycode: "invalid",
                    new_allycode: "456456456",
                    codeCap: 10,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /not a valid ally code/);
        });
    });

    test.describe("payout subcommand", () => {
        test("Should enable payout for char", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "enable",
                    arena: "char",
                    enabled: true,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.payout.char.enabled, true);
            assert.equal(aw.payout.fleet.enabled, false);
            assert.match(result.outLog, /payout.*char.*enabled/);
        });

        test("Should enable payout for fleet", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "enable",
                    arena: "fleet",
                    enabled: true,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.payout.fleet.enabled, true);
            assert.equal(aw.payout.char.enabled, false);
        });

        test("Should enable payout for both arenas", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "enable",
                    arena: "both",
                    enabled: true,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.payout.char.enabled, true);
            assert.equal(aw.payout.fleet.enabled, true);
        });

        test("Should set payout channel for char", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "channel",
                    arena: "char",
                    channelId: "111222333",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.payout.char.channel, "111222333");
            assert.equal(aw.payout.fleet.channel, null);
        });

        test("Should set payout channel for both", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "channel",
                    arena: "both",
                    channelId: "111222333",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.payout.char.channel, "111222333");
            assert.equal(aw.payout.fleet.channel, "111222333");
        });

        test("Should error with invalid payout channel", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "channel",
                    arena: "char",
                    channelId: null,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "Invalid channel, please make sure you're choosing a text channel in this server.");
        });

        test("Should set mark for a player", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "mark",
                    allycode: "123123123",
                    mark: "🔥",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.allycodes[0].mark, "🔥");
            assert.match(result.outLog, /Updated the following marks/);
        });

        test("Should remove mark for a player", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: "⭐",
            });
            const { result, aw } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "mark",
                    allycode: "123123123",
                    remove_mark: true,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.allycodes[0].mark, null);
        });

        test("Should error when player not found for mark", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "mark",
                    allycode: "123123123",
                    mark: "🔥",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /only apply a mark to an already present player/);
        });

        test("Should error when neither mark nor remove_mark provided", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "mark",
                    allycode: "123123123",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "You MUST choose either a mark, or to remove a mark");
        });

        test("Should error when both mark and remove_mark provided", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result } = await processAWChanges({
                target: "payout",
                interactionOptions: {
                    subCommand: "mark",
                    allycode: "123123123",
                    mark: "🔥",
                    remove_mark: true,
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "You MUST choose only one of: mark, remove_mark");
        });
    });

    test.describe("report subcommand", () => {
        test("Should set report to climb", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "report",
                interactionOptions: { arena: "climb" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.report, "climb");
            assert.match(result.outLog, /climb/);
        });

        test("Should set report to drop", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "report",
                interactionOptions: { arena: "drop" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.report, "drop");
        });

        test("Should notify if report already set to same value", async () => {
            const awIn = getDefaultAW();
            awIn.report = "climb";
            const { result } = await processAWChanges({
                target: "report",
                interactionOptions: { arena: "climb" } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.outLog, /already set/);
        });
    });

    test.describe("showvs subcommand", () => {
        test("Should enable showvs", async () => {
            const awIn = getDefaultAW();
            awIn.showvs = false;
            const { result, aw } = await processAWChanges({
                target: "showvs",
                interactionOptions: { enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.showvs, true);
            assert.match(result.outLog, /now show/);
        });

        test("Should disable showvs", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "showvs",
                interactionOptions: { enabled: false } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.showvs, false);
            assert.match(result.outLog, /not show/);
        });

        test("Should notify if showvs already set", async () => {
            const awIn = getDefaultAW();
            awIn.showvs = true;
            const { result } = await processAWChanges({
                target: "showvs",
                interactionOptions: { enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.outLog, /already set/);
        });
    });

    test.describe("warn subcommand", () => {
        test("Should set warn settings for a player", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "warn",
                interactionOptions: {
                    allycode: "123123123",
                    mins: 30,
                    arena: "char",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            const player = aw.allycodes.find((p) => p.allyCode === 123123123);
            assert.equal(player.warn.min, 30);
            assert.equal(player.warn.arena, "char");
            assert.match(result.outLog, /warn setting.*updated/);
        });

        test("Should set warn to none", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
                warn: { min: 30, arena: "char" },
            });
            const { result, aw } = await processAWChanges({
                target: "warn",
                interactionOptions: {
                    allycode: "123123123",
                    mins: 0,
                    arena: "none",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            const player = aw.allycodes.find((p) => p.allyCode === 123123123);
            assert.equal(player.warn.min, null);
            assert.equal(player.warn.arena, null);
        });

        test("Should error with invalid allycode", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "warn",
                interactionOptions: {
                    allycode: "invalid",
                    mins: 30,
                    arena: "char",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /Invalid ally code/);
        });

        test("Should error when allycode not in list", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "warn",
                interactionOptions: {
                    allycode: "123123123",
                    mins: 30,
                    arena: "char",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "That ally code is not in your list.");
        });
    });

    test.describe("result subcommand", () => {
        test("Should set result settings for a player", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result, aw } = await processAWChanges({
                target: "result",
                interactionOptions: {
                    allycode: "123123123",
                    arena: "both",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            const player = aw.allycodes.find((p) => p.allyCode === 123123123);
            assert.equal(player.result, "both");
            assert.match(result.outLog, /result setting.*updated/);
        });

        test("Should set result to none", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
                result: "both",
            });
            const { result, aw } = await processAWChanges({
                target: "result",
                interactionOptions: {
                    allycode: "123123123",
                    arena: "none",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            const player = aw.allycodes.find((p) => p.allyCode === 123123123);
            assert.equal(player.result, null);
        });

        test("Should error with invalid allycode", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "result",
                interactionOptions: {
                    allycode: "invalid",
                    arena: "char",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /Invalid ally code/);
        });

        test("Should error when allycode not in list", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "result",
                interactionOptions: {
                    allycode: "123123123",
                    arena: "char",
                } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(result.error, "That ally code is not in your list.");
        });
    });

    test.describe("use_marks_in_log subcommand", () => {
        test("Should enable use_marks_in_log", async () => {
            const awIn = getDefaultAW();
            const { result, aw } = await processAWChanges({
                target: "use_marks_in_log",
                interactionOptions: { enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.useMarksInLog, true);
            assert.match(result.outLog, /UseMarksInLog.*true/);
        });

        test("Should disable use_marks_in_log", async () => {
            const awIn = getDefaultAW();
            awIn.useMarksInLog = true;
            const { result, aw } = await processAWChanges({
                target: "use_marks_in_log",
                interactionOptions: { enabled: false } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.equal(aw.useMarksInLog, false);
            assert.match(result.outLog, /UseMarksInLog.*false/);
        });

        test("Should error if already set to same value", async () => {
            const awIn = getDefaultAW();
            awIn.useMarksInLog = true;
            const { result } = await processAWChanges({
                target: "use_marks_in_log",
                interactionOptions: { enabled: true } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /already set/);
        });
    });

    test.describe("view subcommand", () => {
        test("Should return embed for viewing settings", async () => {
            const awIn = getDefaultAW();
            awIn.enabled = true;
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: null,
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
            });
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.ok(result.embed);
            assert.equal(result.embed.title, "Arena Watch Settings");
        });

        test("Should return embed for specific allycode", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push({
                allyCode: 123123123,
                name: "TestPlayer",
                mention: "999888777",
                lastChar: 50,
                lastShip: 100,
                poOffset: 300,
                mark: null,
                result: "char",
                warn: { min: 30, arena: "char" },
            });
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { allycode: "123123123", codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.ok(result.embed);
            assert.match(result.embed.title, /123123123/);
        });

        test("Should error with invalid allycode for view", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { allycode: "invalid", codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /not a valid ally code/);
        });

        test("Should error when allycode not in list for view", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { allycode: "123123123", codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.match(result.error, /not listed in your registered ally codes/);
        });

        test("Should sort by char_rank when specified", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push(
                { allyCode: 123123123, name: "Player1", mention: null, lastChar: 50, lastShip: 100, poOffset: 300, mark: null },
                { allyCode: 456456456, name: "Player2", mention: null, lastChar: 10, lastShip: 200, poOffset: 300, mark: null },
            );
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { view_by: "char_rank", codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.ok(result.embed);
        });

        test("Should sort by fleet_rank when specified", async () => {
            const awIn = getDefaultAW();
            awIn.allycodes.push(
                { allyCode: 123123123, name: "Player1", mention: null, lastChar: 50, lastShip: 200, poOffset: 300, mark: null },
                { allyCode: 456456456, name: "Player2", mention: null, lastChar: 10, lastShip: 50, poOffset: 300, mark: null },
            );
            const { result } = await processAWChanges({
                target: "view",
                interactionOptions: { view_by: "fleet_rank", codeCap: 10 } as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.ok(result.embed);
        });
    });

    test.describe("fillAWSkeleton", () => {
        test("Should return default AW when null passed", () => {
            const aw = fillAWSkeleton(null);
            assert.equal(aw.enabled, false);
            assert.deepEqual(aw.allycodes, []);
            assert.equal(aw.useMarksInLog, false);
            assert.equal(aw.report, "both");
            assert.equal(aw.showvs, true);
        });

        test("Should fill missing payout when not present", () => {
            const awIn = {
                enabled: true,
                allycodes: [],
                channel: null,
                arena: { fleet: { channel: null, enabled: false }, char: { channel: null, enabled: false } },
            } as any;
            const aw = fillAWSkeleton(awIn);
            assert.ok(aw.payout);
            assert.ok(aw.payout.char);
            assert.ok(aw.payout.fleet);
        });

        test("Should set defaults for useMarksInLog, report, showvs", () => {
            const awIn = {
                enabled: true,
                allycodes: [],
                channel: null,
                arena: { fleet: { channel: null, enabled: false }, char: { channel: null, enabled: false } },
                payout: { char: { enabled: false, channel: null, msgID: null }, fleet: { enabled: false, channel: null, msgID: null } },
            } as any;
            const aw = fillAWSkeleton(awIn);
            assert.equal(aw.useMarksInLog, false);
            assert.equal(aw.report, "both");
            assert.equal(aw.showvs, true);
        });
    });

    test.describe("invalid target", () => {
        test("Should return error for invalid target", async () => {
            const awIn = getDefaultAW();
            const { result } = await processAWChanges({
                target: "invalid_target",
                interactionOptions: {} as any,
                aw: awIn,
                unitStats: mockUnitStats(),
            });
            assert.deepEqual(result.errorKey, ["COMMAND_ARENAWATCH_INVALID_OPTION"]);
        });
    });
});
