import assert from "node:assert";
import { describe, it } from "node:test";
import { getCurrentWeekday } from "../../modules/functions.ts";
import Activities from "../../slash/activities.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertReplyCount, getLastReply } from "./helpers.ts";

// activities maps the chosen day to the lang key COMMAND_ACTIVITIES_<DAY> and replies with it
// inside an asciiDoc code block. MockLanguage echoes the key, so asserting the exact key verifies
// the day -> key construction (split + uppercase), not just that a reply happened.
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function runForDay(day?: string) {
    const interaction = createMockInteraction(day ? { optionsData: { day: `day_${day}` } } : undefined);
    const command = new Activities();
    const ctx = createCommandContext({ interaction });
    await command.run(ctx);
    return { interaction, ctx };
}

describe("Activities", () => {
    it("builds the exact lang key for each specified day", async () => {
        for (const day of DAYS) {
            const { interaction } = await runForDay(day);
            const reply = getLastReply(interaction);
            assert.ok(
                reply.content.includes(`COMMAND_ACTIVITIES_${day.toUpperCase()}`),
                `Expected COMMAND_ACTIVITIES_${day.toUpperCase()} for ${day}`,
            );
        }
    });

    it("defaults to today's key when no day is given", async () => {
        const { interaction, ctx } = await runForDay();
        const expectedDay = getCurrentWeekday(ctx.guildSettings?.timezone || undefined);
        const reply = getLastReply(interaction);
        assert.ok(
            reply.content.includes(`COMMAND_ACTIVITIES_${expectedDay.toUpperCase()}`),
            `Expected today's key COMMAND_ACTIVITIES_${expectedDay.toUpperCase()}`,
        );
    });

    it("wraps the output in an asciiDoc code block", async () => {
        const { interaction } = await runForDay("Monday");
        const reply = getLastReply(interaction);
        assert.ok(reply.content.startsWith("```asciiDoc\n"), "Expected an asciiDoc code block fence");
        assert.ok(reply.content.trimEnd().endsWith("```"), "Expected the code block to be closed");
    });

    it("sends exactly one reply", async () => {
        const { interaction } = await runForDay("Monday");
        assertReplyCount(interaction, 1);
    });
});
