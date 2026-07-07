import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyProfile from "../../slash/myprofile.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit, createRealLanguage } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyProfile", () => {
    const originalPlayer = swgohAPI.player;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
    });

    it("should return error when no allyCode is registered and none provided", async () => {
        const interaction = createMockInteraction({ optionsData: {} });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_INVALID_ALLY_CODE_AC");
    });

    it("should return error when player data cannot be fetched", async () => {
        swgohAPI.player = async () => null;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_MYPROFILE_NO_ALLY_CODE");
    });

    it("should display player profile with stats and GP", async () => {
        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            guildName: "Test Guild",
            level: 85,
            updated: Date.now(),
            arena: {
                char: { rank: 42, squad: [] },
                ship: { rank: 17, squad: [] },
            },
            stats: [
                { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
                { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
                { nameKey: "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
            ],
            roster: [
                createMockUnit({ defId: "DARTHVADER", combatType: 1, rarity: 7, skills: [], mods: [] }),
                createMockUnit({ defId: "CAPITALCHIMAERA", combatType: 2, rarity: 7, skills: [], mods: [] }),
            ],
        });
        swgohAPI.player = async () => mockPlayer;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        // Real language so the COMMAND_MYPROFILE_CHARS/SHIPS/MODS stat objects actually render
        // their computed values. With the key-echoing mock these fields come back undefined.
        const ctx = createCommandContext({ interaction, language: createRealLanguage() });
        const command = new MyProfile();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embedData = reply.embeds[0].data || reply.embeds[0];
        assert.ok(embedData.author?.name, "Expected author in embed");

        const field = (match: string) =>
            embedData.fields?.find((f: { name: string }) => f.name.includes(match)) as { name: string; value: string } | undefined;

        // Characters field: 1 char (Vader, 7*), char GP 3,000,000 (from STAT_CHARACTER_GALACTIC_POWER).
        const chars = field("Characters (1)");
        assert.ok(chars, "Expected a Characters field rendered by the real lang function");
        assert.match(chars.value, /Char GP\s*::\s*3,000,000/, "Expected rendered char GP");
        assert.match(chars.value, /7 Star\s*::\s*1/, "Expected one 7* character");
        assert.match(chars.value, /Zetas\s*::\s*0/, "Expected zero zetas");

        // Ships field: 1 ship (Chimaera, 7*), ship GP 2,000,000.
        const ships = field("Ships (1)");
        assert.ok(ships, "Expected a Ships field");
        assert.match(ships.value, /Ship GP\s*::\s*2,000,000/, "Expected rendered ship GP");
        assert.match(ships.value, /7 Star\s*::\s*1/, "Expected one 7* ship");

        // Mods field: no mods on the roster, so all counts render as 0.
        const modsField = field("Mod Overview");
        assert.ok(modsField, "Expected a Mod Overview field");
        assert.match(modsField.value, /6\* Mods\s*::\s*0/, "Expected rendered mod counts");
    });

    it("should return error when player has no stats", async () => {
        const mockPlayer = createMockPlayer({
            allyCode: 123456789,
            name: "TestPlayer",
            stats: [],
            roster: [],
        });
        swgohAPI.player = async () => mockPlayer;

        const interaction = createMockInteraction({ optionsData: { allycode: "123456789" } });
        const ctx = createCommandContext({ interaction });
        const command = new MyProfile();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_MYPROFILE_PLAYER_NOT_FOUND");
    });
});
