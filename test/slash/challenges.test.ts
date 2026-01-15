import assert from "node:assert/strict";
import test from "node:test";
import Challenges from "../../slash/challenges.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Challenges Command", () => {
    test("run() should reply with correct challenges when Friday is provided", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "day_Friday" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Challenges(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].content);
        assert.match(replyCalls[0].content, /Friday/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_BOUNTY/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_AGILITY/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_SHIP_BUILDING/);
    });

    test("run() should show Sunday challenges correctly", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "day_Sunday" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Challenges(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.match(replyCalls[0].content, /Sunday/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_TRAINING/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_ABILITY/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_TACTICS/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_SHIP_ABILITY/);
    });

    test("run() should default to current weekday when no day provided", async () => {
        const bot = createMockBot({
            getCurrentWeekday: () => "Wednesday",
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => null } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Challenges(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].content);
        assert.match(replyCalls[0].content, /Wednesday/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_ABILITY/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_TACTICS/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_SHIP_ENHANCEMENT/);
    });

    test("run() should use guild timezone when no day provided and timezone is set", async () => {
        const bot = createMockBot({
            getCurrentWeekday: (tz?: string) => (tz === "America/New_York" ? "Thursday" : "Monday"),
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => null } as any,
            guildSettings: { timezone: "America/New_York" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Challenges(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0);
        assert.match(replyCalls[0].content, /Thursday/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_STRENGTH/);
        assert.match(replyCalls[0].content, /COMMAND_CHALLENGES_SHIP_ABILITY/);
    });
});
