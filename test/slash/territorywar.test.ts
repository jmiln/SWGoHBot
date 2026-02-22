import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import TerritoryWar from "../../slash/territorywar.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockGuild, createMockGuildMember, createMockPlayer, createMockUnit } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("TerritoryWar", () => {
    const originalPlayer = swgohAPI.player;
    const originalGuild = swgohAPI.guild;
    const originalUnitStats = swgohAPI.unitStats;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.guild = originalGuild;
        swgohAPI.unitStats = originalUnitStats;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.guild = originalGuild;
        swgohAPI.unitStats = originalUnitStats;
    });

    it("should initialize with correct name", () => {
        const command = new TerritoryWar();
        assert.strictEqual(command.commandData.name, "territorywar");
    });

    it("should have allycode_1 and allycode_2 options", () => {
        const command = new TerritoryWar();
        const optionNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(optionNames.includes("allycode_1"), "Expected allycode_1 option");
        assert.ok(optionNames.includes("allycode_2"), "Expected allycode_2 option");
    });

    it("should return error when ally code 1 cannot be resolved", async () => {
        // reply() is called first, then patreonFuncs.getPlayerCooldown (MongoDB), then getAllyCode
        // Unregistered user + no allycode_1 provided → getAllyCode returns null → error
        const interaction = createMockInteraction({ optionsData: {} });
        const ctx = createCommandContext({ interaction });
        const command = new TerritoryWar();
        await command.run(ctx);
        assertErrorReply(interaction);
    });

    it("should display guild comparison when both guilds are found", async () => {
        const unit = createMockUnit({ defId: "VADER", combatType: 1, rarity: 7, gear: 13, relic: { currentTier: 9 }, skills: [] });
        const member1 = createMockGuildMember({ allyCode: 111111111 });
        const member2 = createMockGuildMember({ allyCode: 222222222 });
        const player1 = createMockPlayer({ allyCode: 111111111, name: "Player One", guildId: "guild-a", roster: [unit] });
        const player2 = createMockPlayer({ allyCode: 222222222, name: "Player Two", guildId: "guild-b", roster: [unit] });

        const guild1 = createMockGuild({ id: "guild-a", name: "Guild Alpha", gp: 200000000, members: 50, roster: [member1] });
        const guild2 = createMockGuild({ id: "guild-b", name: "Guild Beta", gp: 180000000, members: 48, roster: [member2] });

        swgohAPI.player = async (allycode) => {
            if (String(allycode) === "111111111") return player1;
            if (String(allycode) === "222222222") return player2;
            return null;
        };
        swgohAPI.guild = async (allycode) => {
            if (String(allycode) === "111111111") return guild1;
            if (String(allycode) === "222222222") return guild2;
            return null;
        };
        swgohAPI.unitStats = async (allycodes) => {
            const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];
            return acArr.map((ac) => createMockPlayer({ allyCode: Number(ac), roster: [unit] }));
        };

        const interaction = createMockInteraction({
            optionsData: { allycode_1: "111111111", allycode_2: "222222222" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new TerritoryWar();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embed = reply.embeds[0];
        const embedData = embed.data || embed;
        assert.ok(
            JSON.stringify(embedData).includes("Guild Alpha") || JSON.stringify(embedData).includes("Guild Beta"),
            "Expected guild name in embed",
        );
    });
});
