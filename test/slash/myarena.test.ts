import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyArena from "../../slash/myarena.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyArena", () => {
    const originalPlayer = swgohAPI.player;
    const originalLangChar = swgohAPI.langChar;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
    });

    it("should initialize with correct name", () => {
        const command = new MyArena();
        assert.strictEqual(command.commandData.name, "myarena");
    });

    it("should return error when no allycode is registered and none provided", async () => {
        // myarena calls interaction.reply() first, then getAllyCode → error via editReply
        const interaction = createMockInteraction({ optionsData: {} });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);
        assertErrorReply(interaction, "Invalid user ID");
    });

    it("should return error when player data cannot be fetched", async () => {
        swgohAPI.player = async () => null;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SOMETHING_BROKE");
    });

    it("should display arena squads with unit names", async () => {
        const vaderUnit = createMockUnit({ defId: "DARTHVADER", nameKey: "Darth Vader", skills: [], combatType: 1 });
        const chimaeraUnit = createMockUnit({ defId: "CAPITALCHIMAERA", nameKey: "Chimaera", skills: [], combatType: 2 });

        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [{ id: "uuid-vader-001", defId: "DARTHVADER" }] },
                ship: { rank: 17, squad: [{ id: "uuid-chimaera-001", defId: "CAPITALCHIMAERA" }] },
            },
            roster: [vaderUnit, chimaeraUnit],
        });

        swgohAPI.player = async () => mockPlayer;
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.fields?.length > 0, "Expected fields in embed");

        const allFieldValues = embedData.fields.map((f: any) => f.value).join("\n");
        assert.ok(allFieldValues.includes("Darth Vader"), "Expected char arena unit in fields");
        assert.ok(allFieldValues.includes("Chimaera"), "Expected ship arena unit in fields");
    });

    it("should show stats table when stats option is true", async () => {
        const vaderUnit = createMockUnit({
            defId: "DARTHVADER",
            nameKey: "Darth Vader",
            skills: [],
            combatType: 1,
            stats: { final: { Speed: 200, Health: 50000, Protection: 30000 } as any, mods: {} as any, gp: 25000 },
        });

        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [{ id: "uuid-vader-001", defId: "DARTHVADER" }] },
                ship: { rank: 17, squad: [] },
            },
            roster: [vaderUnit],
        });

        swgohAPI.player = async () => mockPlayer;
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789", stats: true } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(embedData.description?.includes("Darth Vader"), "Expected unit name in stats table");
    });

    it("should show a payout timestamp line above each arena squad list", async () => {
        const vaderUnit = createMockUnit({ defId: "DARTHVADER", nameKey: "Darth Vader", skills: [], combatType: 1 });
        const chimaeraUnit = createMockUnit({ defId: "CAPITALCHIMAERA", nameKey: "Chimaera", skills: [], combatType: 2 });

        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [{ id: "uuid-vader-001", defId: "DARTHVADER" }] },
                ship: { rank: 17, squad: [{ id: "uuid-chimaera-001", defId: "CAPITALCHIMAERA" }] },
            },
            roster: [vaderUnit, chimaeraUnit],
        });

        swgohAPI.player = async () => mockPlayer;
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        const embedData = reply.embeds[0].data || reply.embeds[0];
        const payoutRegex = /COMMAND_MYARENA_PAYOUT: <t:\d+:t> \(<t:\d+:R>\)/;
        const arenaFields = embedData.fields.filter((f: any) => payoutRegex.test(f.value));
        assert.strictEqual(arenaFields.length, 2, "Expected a payout line in both arena fields");
        // Payout line sits above the squad list
        const charField = embedData.fields.find((f: any) => f.value.includes("Darth Vader"));
        assert.ok(
            charField.value.indexOf("COMMAND_MYARENA_PAYOUT") < charField.value.indexOf("Darth Vader"),
            "Expected payout line above the squad list",
        );
    });

    it("should omit the payout line when poUTCOffsetMinutes is missing", async () => {
        const vaderUnit = createMockUnit({ defId: "DARTHVADER", nameKey: "Darth Vader", skills: [], combatType: 1 });

        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [{ id: "uuid-vader-001", defId: "DARTHVADER" }] },
                ship: { rank: 17, squad: [] },
            },
            roster: [vaderUnit],
            // The type requires a number, but live data can omit it - that's the case under test
            poUTCOffsetMinutes: undefined as unknown as number,
        });

        swgohAPI.player = async () => mockPlayer;
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        const embedData = reply.embeds[0].data || reply.embeds[0];
        const allFieldValues = embedData.fields.map((f: any) => f.value).join("\n");
        assert.ok(!allFieldValues.includes("COMMAND_MYARENA_PAYOUT"), "Expected no payout line without poUTCOffsetMinutes");
    });

    it("should show the payout line above the stats table in stats view", async () => {
        const vaderUnit = createMockUnit({
            defId: "DARTHVADER",
            nameKey: "Darth Vader",
            skills: [],
            combatType: 1,
            stats: { final: { Speed: 200, Health: 50000, Protection: 30000 } as any, mods: {} as any, gp: 25000 },
        });

        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [{ id: "uuid-vader-001", defId: "DARTHVADER" }] },
                ship: { rank: 17, squad: [] },
            },
            roster: [vaderUnit],
        });

        swgohAPI.player = async () => mockPlayer;
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789", stats: true } });
        const ctx = createCommandContext({ interaction });
        const command = new MyArena();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        const embedData = reply.embeds[0].data || reply.embeds[0];
        assert.match(embedData.description, /COMMAND_MYARENA_PAYOUT: <t:\d+:t> \(<t:\d+:R>\)/);
        assert.ok(
            embedData.description.indexOf("COMMAND_MYARENA_PAYOUT") < embedData.description.indexOf("Darth Vader"),
            "Expected payout line above the stats table",
        );
    });
});
