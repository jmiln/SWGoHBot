import assert from "node:assert";
import { describe, it } from "node:test";
import Challenges from "../../slash/challenges.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount, getLastReply } from "./helpers.ts";

// challenges maps each weekday to the set of challenges available that day. MockLanguage echoes
// the lang keys, so the challenge names in the output are the COMMAND_CHALLENGES_* keys. These
// tests assert the exact per-day challenge set (the real logic), plus header/formatting and the
// unknown-day error branch. Expected sets verified against the challenges map in slash/challenges.ts.
const MONDAY = [
    "COMMAND_CHALLENGES_TRAINING",
    "COMMAND_CHALLENGES_STRENGTH",
    "COMMAND_CHALLENGES_SHIP_ENHANCEMENT",
    "COMMAND_CHALLENGES_SHIP_BUILDING",
    "COMMAND_CHALLENGES_SHIP_ABILITY",
];
const SUNDAY = [
    "COMMAND_CHALLENGES_TRAINING",
    "COMMAND_CHALLENGES_ABILITY",
    "COMMAND_CHALLENGES_BOUNTY",
    "COMMAND_CHALLENGES_AGILITY",
    "COMMAND_CHALLENGES_STRENGTH",
    "COMMAND_CHALLENGES_TACTICS",
    "COMMAND_CHALLENGES_SHIP_ABILITY",
];

async function runForDay(day: string) {
    const interaction = createMockInteraction({ optionsData: { day: `day_${day}` } });
    const command = new Challenges();
    await command.run(createCommandContext({ interaction }));
    return interaction;
}

/** Pull the "* <challenge>" lines out of the asciiDoc code block. */
function challengeLines(interaction: unknown): string[] {
    const content = getLastReply(interaction as never).content as string;
    return content
        .split("\n")
        .filter((l) => l.startsWith("* "))
        .map((l) => l.slice(2).trim());
}

describe("Challenges", () => {
    it("lists exactly the challenges available on Monday", async () => {
        const interaction = await runForDay("Monday");
        assert.deepStrictEqual(new Set(challengeLines(interaction)), new Set(MONDAY));
    });

    it("lists exactly the challenges available on Sunday", async () => {
        const interaction = await runForDay("Sunday");
        assert.deepStrictEqual(new Set(challengeLines(interaction)), new Set(SUNDAY));
    });

    it("includes a header naming the requested day", async () => {
        const interaction = await runForDay("Wednesday");
        const reply = getLastReply(interaction);
        assert.ok(reply.content.includes("Challenges for Wednesday"), "Expected the day header");
    });

    it("wraps the output in an asciiDoc code block and replies once", async () => {
        const interaction = await runForDay("Friday");
        const reply = getLastReply(interaction);
        assert.ok(reply.content.startsWith("```asciiDoc\n"), "Expected an asciiDoc code block fence");
        assert.ok(reply.content.trimEnd().endsWith("```"), "Expected the code block to be closed");
        assertReplyCount(interaction, 1);
    });

    it("errors on an unrecognized day", async () => {
        const interaction = createMockInteraction({ optionsData: { day: "day_Notaday" } });
        const command = new Challenges();
        await command.run(createCommandContext({ interaction }));
        assertErrorReply(interaction, "COMMAND_CHALLENGES_UNKNOWN_DAY");
    });
});
