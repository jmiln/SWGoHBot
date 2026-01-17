import assert from "node:assert/strict";
import test from "node:test";
import Modsets from "../../slash/modsets.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Modsets Command", () => {
    test("command is instantiated with correct name", () => {
        const bot = createMockBot();
        const cmd = new Modsets(bot);
        assert.equal(cmd.commandData.name, "modsets");
        assert.equal(cmd.commandData.guildOnly, false);
    });

    test("run() displays modset information", async () => {
        const bot = createMockBot();

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            reply: async (data: any) => replyCalls.push(data),
            language: {
                get: (key: string) => {
                    if (key === "COMMAND_MODSETS_OUTPUT") {
                        return "Modset information here";
                    }
                    return key;
                },
            } as any,
        });

        const cmd = new Modsets(bot);
        await cmd.run(bot, interaction);

        assert.equal(replyCalls.length, 1);
        assert.ok(replyCalls[0].content.includes("Modset information"));
    });
});
