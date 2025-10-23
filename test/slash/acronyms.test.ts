import assert from "node:assert/strict";
import test from "node:test";
import type { InteractionReplyOptions } from "discord.js";
import Acronyms from "../../slash/acronyms.ts"; // adjust the import path
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Acronyms Command", () => {
    test("parseAcronymInput() splits and lowercases input", () => {
        const cmd = new Acronyms(createMockBot());
        const result = cmd["parseAcronymInput"]("CLS TB SlKr");
        assert.deepEqual(result, ["cls", "tb", "slkr"]);
    });

    test("formatAcronymMessage() correctly formats output", () => {
        const bot = createMockBot();
        const cmd = new Acronyms(bot);
        const result = cmd["formatAcronymMessage"](["CLS", "TB"], bot.acronyms);
        assert.equal(result, "**CLS**: Commander Luke Skywalker\n**TB**: Territory Battle");
    });

    test("findMatchingAcronyms() finds existing acronyms", () => {
        const bot = createMockBot();
        const cmd = new Acronyms(bot);
        const result = cmd["findMatchingAcronyms"]("CLS TB", bot.acronyms);
        assert.deepEqual(result, ["CLS", "TB"]);
    });

    test("run() replies with correct embed for a valid acronym", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            options: { getString: () => "CLS" } as any,
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new Acronyms(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        const embed = replyCalls[0].embeds[0];
        assert.equal(embed.description, "**Acronyms for:**\n- CLS");
        assert.equal(embed.fields[0].value, "**CLS**: Commander Luke Skywalker");
    });

    test("run() returns error if acronym input is empty", async () => {
        const bot = createMockBot();
        let errorMessage: string | undefined;

        const cmd = new Acronyms(bot);
        (cmd as any).handleError = async (_i: any, msg: string) => (errorMessage = msg);

        const interaction = createMockInteraction({
            options: { getString: () => "" } as any,
        });

        await cmd.run(bot, interaction);
        assert.equal(errorMessage, "COMMAND_ACRONYMS_INVALID");
    });

    test("run() returns error if acronym not found", async () => {
        const bot = createMockBot();
        let errorMessage: string | undefined;

        const cmd = new Acronyms(bot);
        (cmd as any).handleError = async (_i: any, msg: string) => (errorMessage = msg);

        const interaction = createMockInteraction({
            options: { getString: () => "XYZ" } as any,
        });

        await cmd.run(bot, interaction);
        assert.equal(errorMessage, "COMMAND_ACRONYMS_NOT_FOUND");
    });
});
