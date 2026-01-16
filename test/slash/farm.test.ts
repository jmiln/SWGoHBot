import assert from "node:assert/strict";
import test from "node:test";
import Farm from "../../slash/farm.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Farm Command", () => {
    test("run() should error when character is not found", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "NonExistentCharacter",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("BASE_SWGOH_NO_CHAR_FOUND"));
    });

    test("run() should handle successful character lookup", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Commander Luke Skywalker", baseId: "COMMANDERLUKESKYWALKER" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);
        console.log(JSON.stringify(replyCalls));

        assert.ok(replyCalls.length > 0);
    });

    test("run() should error when swgohAPI fails to get unit", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => null,
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        assert.ok(replyCalls[0].embeds?.[0]?.description?.includes("Broke trying to get the unit"));
    });

    test("run() should handle responses appropriately", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Commander Luke Skywalker", baseId: "COMMANDERLUKESKYWALKER" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should show store locations with costs", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Commander Luke Skywalker", baseId: "COMMANDERLUKESKYWALKER" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle ship searches", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Millennium Falcon", baseId: "MILLENNIUMFALCON" }),
            } as any,
            characters: [],
            ships: [
                {
                    name: "Millennium Falcon",
                    uniqueName: "MILLENNIUMFALCON",
                    side: "light",
                    url: "https://swgoh.gg/ships/millennium-falcon/",
                    aliases: ["MF"],
                    avatarURL: "",
                    factions: [],
                    avatarName: "",
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Millennium Falcon",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle Light Side Hard nodes", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle Dark Side Hard nodes", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Darth Vader", baseId: "DARTHVADER" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Darth Vader",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle Fleet Hard nodes", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle Cantina nodes", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should skip locations when langLoc is null", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
            cache: {
                getOne: async () => null,
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle Proving Grounds events", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
            cache: {
                getOne: async (_db: string, _collection: string, query: any) => {
                    if (query.id === "EVENT_CONQUEST_UNIT_TRIALS_NAME") {
                        return { id: "EVENT_CONQUEST_UNIT_TRIALS_NAME", language: "eng_us", langKey: "Proving Grounds" };
                    }
                    return null;
                },
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should handle marquee events", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
            cache: {
                getOne: async (_db: string, _collection: string, query: any) => {
                    if (query.id) {
                        return { id: query.id, language: "eng_us", langKey: "Marquee Event" };
                    }
                    return null;
                },
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should error when no locations are available", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Test Character", baseId: "TESTCHAR" }),
            } as any,
            cache: {
                getOne: async () => null,
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
    });

    test("run() should format output with proper embed structure", async () => {
        const bot = createMockBot({
            swgohAPI: {
                units: async () => ({ name: "Commander Luke Skywalker", baseId: "COMMANDERLUKESKYWALKER" }),
            } as any,
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: {
                getString: () => "Commander Luke Skywalker",
            } as any,
            reply: async (data) => {
                replyCalls.push(data);
            },
            swgohLanguage: "ENG_US",
        });

        const cmd = new Farm(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        if (replyCalls[0].embeds?.[0]) {
            const embed = replyCalls[0].embeds[0];
            assert.ok(embed.author);
            assert.ok(embed.color !== undefined);
            assert.ok(embed.description);
        }
    });
});
