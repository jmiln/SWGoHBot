import assert from "node:assert/strict";
import test, {mock} from "node:test";
import Aliases from "../../slash/aliases.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

const testCharacter = { alias: "CLS", name: "Commander Luke Skywalker", defId: "COMMANDERLUKESKYWALKER" };

class MockCommand extends Aliases {
	constructor(bot) {
		super(bot);
		this.success = mock.fn(async (_interaction, message) => {return message;});
		this.error = mock.fn(async (_interaction, message) => {return message;});
	}
}

test.describe("Aliases Command", () => {
    test("adds a new alias successfully", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            guild: { id: "123" },
            options: {
                getSubcommand: () => "add",
                getString: (key: string) => {
                    if (key === "unit") return "COMMANDERLUKESKYWALKER";
                    if (key === "alias") return "CLS";
                }
            },
            reply: async (data) => replyCalls.push(data)
        });


        const cmd = new MockCommand(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length);
        assert.match(replyCalls[0].embeds[0].description, /alias \(CLS\) for \*\*\*Commander Luke Skywalker\*\*\* has been successfully submitted/i);
    });

    test("fails when alias already exists", async () => {
        const bot = createMockBot({
            cache: {
                get: () => [{aliases: [testCharacter]}]
            }
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            guild: { id: "123" },
            options: {
                getSubcommand: () => "add",
                getString: (key: string) => {
                    if (key === "unit") return "COMMANDERLUKESKYWALKER";
                    if (key === "alias") return "CLS";
                }
            },
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new MockCommand(bot as any);
        await cmd.run(bot as any, interaction);

        assert.match(replyCalls[0].embeds[0].description, /already in use/i);
    });

    test("removes an existing alias", async () => {
        const bot = createMockBot({
            cache: {
                get: () => [{aliases: [testCharacter]}]
            }
        });

        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            guild: { id: "123" },
            options: {
                getSubcommand: () => "remove",
                getString: () => "CLS",
            },
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new Aliases(bot as any);
        await cmd.run(bot as any, interaction);

        assert.match(replyCalls[0].embeds[0].description, /successfully removed/i);
    });

    test("fails to remove a nonexistent alias", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            guild: { id: "123" },
            options: {
                getSubcommand: () => "remove",
                getString: () => "xyz",
            },
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new Aliases(bot as any);
        await cmd.run(bot as any, interaction);

        assert.match(replyCalls[0].embeds[0].description, /isn't a current alias/i);
    });

    test("lists all current aliases", async () => {
        const bot = createMockBot({
            cache: {
                get: () => [{aliases: [testCharacter]}]
            }
        });
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            guild: { id: "123" },
            options: {
                getSubcommand: () => "list", // fallback case
                getString: () => null,
            },
            reply: async (data) => replyCalls.push(data),
        });

        const cmd = new Aliases(bot as any);
        await cmd.run(bot as any, interaction);

        assert.match(replyCalls[0].content, /cls - Commander Luke/i);
    });

});




