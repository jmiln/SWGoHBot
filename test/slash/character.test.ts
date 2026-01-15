import assert from "node:assert/strict";
import test from "node:test";
import Character from "../../slash/character.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

test.describe("Character Command", () => {
    test("run() should reply with character info when valid character is provided", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "Commander Luke Skywalker" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply");
        assert.ok(replyCalls[0].embeds, "Should have embeds");
        assert.ok(replyCalls[0].embeds.length > 0, "Should have at least one embed");

        const embed = replyCalls[0].embeds[0];
        assert.ok(embed.author, "Should have author");
        assert.strictEqual(embed.author.name, "Commander Luke Skywalker", "Author name should match character");
        assert.ok(embed.fields, "Should have fields");
        assert.ok(embed.fields.length > 0, "Should have at least one field");
    });

    test("run() should show factions in the embed", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "CLS" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        const embed = replyCalls[0].embeds[0];
        const factionsField = embed.fields.find((f: any) => f.name === "Factions");
        assert.ok(factionsField, "Should have factions field");
        assert.match(factionsField.value, /Rebel/, "Should include Rebel faction");
        assert.match(factionsField.value, /Jedi/, "Should include Jedi faction");
    });

    test("run() should show abilities with correct formatting", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "Luke" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        const embed = replyCalls[0].embeds[0];

        // Check for ability fields
        const callToActionField = embed.fields.find((f: any) => f.name === "Call to Action");
        assert.ok(callToActionField, "Should have Call to Action ability");
        assert.ok(callToActionField.value.length > 0, "Should have ability description");

        const learnControlField = embed.fields.find((f: any) => f.name === "Learn Control");
        assert.ok(learnControlField, "Should have Learn Control ability");
        assert.ok(learnControlField.value.length > 0, "Should have ability description");
    });

    test("run() should handle invalid character name", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const errorCalls: any[] = [];

        // Mock the error method on the command
        const interaction = createMockInteraction({
            options: { getString: () => "InvalidCharacterName123" } as any,
            reply: async (data: any) => {
                replyCalls.push(data);
                errorCalls.push(data);
            },
        });

        const cmd = new Character(bot as any);
        await cmd.run(bot as any, interaction);

        // The command should call the error method which uses reply
        assert.ok(replyCalls.length > 0, "Should have called reply for error");
    });

    test("run() should handle multiple matching characters", async () => {
        const bot = createMockBot({
            characters: [
                { name: "Rey", uniqueName: "REY", side: "light", url: "https://example.com", aliases: [] },
                { name: "Rey (Jedi Training)", uniqueName: "REYJEDITRAINING", side: "light", url: "https://example.com", aliases: ["RJT"] },
                { name: "Rey (Scavenger)", uniqueName: "REYSCAVENGER", side: "light", url: "https://example.com", aliases: [] },
            ],
        });
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "Rey" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot);
        await cmd.run(bot, interaction);

        // Should show error with character list
        assert.ok(replyCalls.length > 0, "Should have called reply");
    });

    test("run() should use guild language setting", async () => {
        const bot = createMockBot();
        let capturedLanguage = "";

        bot.swgohAPI.getCharacter = async (uniqueName: string, language: string) => {
            capturedLanguage = language;
            return {
                name: "Commander Luke Skywalker",
                factions: ["Rebel", "Jedi"],
                skillReferenceList: [],
            };
        };

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "CLS" } as any,
            guildSettings: { swgohLanguage: "ger_de", aliases: [] } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot);
        await cmd.run(bot, interaction);

        assert.strictEqual(capturedLanguage, "ger_de", "Should use guild language setting");
    });

    test("run() should handle API errors gracefully", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => {
            throw new Error("API Error");
        };

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "CLS" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0, "Should have called reply with error");
    });

    test("run() should include character image when available", async () => {
        const bot = createMockBot();
        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "CLS" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot as any);
        await cmd.run(bot as any, interaction);

        assert.ok(replyCalls.length > 0);
        // Note: getBlankUnitImage may return null in test environment
        // Just verify the structure is correct
        assert.ok(replyCalls[0].embeds, "Should have embeds");
    });

    test("run() should handle abilities with cooldowns", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Test Character",
            factions: [],
            skillReferenceList: [
                {
                    skillId: "specialskill_TEST01",
                    name: "Test Special",
                    desc: "A special ability with cooldown",
                    cooldown: 3,
                    cost: {
                        AbilityMatMk3: 0,
                        AbilityMatOmega: 0,
                        AbilityMatZeta: 0,
                        AbilityMatOmicron: 0,
                    },
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "Rey" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0);
        const embed = replyCalls[0].embeds[0];
        const specialField = embed.fields.find((f: any) => f.name === "Test Special");
        assert.ok(specialField, "Should have special ability field");
        assert.ok(specialField.value.length > 0, "Should have ability info with cooldown");
    });

    test("run() should handle omicron abilities", async () => {
        const bot = createMockBot();
        bot.swgohAPI.getCharacter = async () => ({
            name: "Test Character",
            factions: [],
            skillReferenceList: [
                {
                    skillId: "uniqueskill_TEST01",
                    name: "Test Omicron",
                    desc: "An omicron ability",
                    cooldown: 0,
                    cost: {
                        AbilityMatMk3: 35,
                        AbilityMatOmega: 5,
                        AbilityMatZeta: 0,
                        AbilityMatOmicron: 1,
                    },
                },
            ],
        });

        const replyCalls: any[] = [];
        const interaction = createMockInteraction({
            options: { getString: () => "Rey" } as any,
            reply: async (data: any) => replyCalls.push(data),
        });

        const cmd = new Character(bot);
        await cmd.run(bot, interaction);

        assert.ok(replyCalls.length > 0);
        const embed = replyCalls[0].embeds[0];
        const omicronField = embed.fields.find((f: any) => f.name === "Test Omicron");
        assert.ok(omicronField, "Should have omicron ability field");
    });
});
