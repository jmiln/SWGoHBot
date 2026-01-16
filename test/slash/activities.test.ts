import assert from "node:assert/strict";
import test from "node:test";
import Activities from "../../slash/activities.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Activities Command", () => {
    test("run() should reply with correct message when day is provided", async () => {
        const bot = createMockBot();

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "day_Friday", } as any,
            reply: async (data) => { replyCalls.push(data); },
        });

        const cmd = new Activities(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.match(replyCalls[0].content, /COMMAND_ACTIVITIES_FRIDAY/)
    });

    test("run() should default to current weekday when none provided", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {getString: () => ""} as any,
            reply: async (data) => replyCalls.push(data)
        });
        const cmd = new Activities(bot);
        await cmd.run(bot, interaction);

        // Should match one of the day patterns (test works regardless of current day)
        assert.match(replyCalls[0].content, /COMMAND_ACTIVITIES_(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/);
    });
});




