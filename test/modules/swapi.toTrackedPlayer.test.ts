import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import { loadStoredTrackedPlayers, toTrackedPlayer } from "../../modules/swapi.ts";
import type { SWAPIPlayer } from "../../types/swapi_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const formatted = {
    id: "player-id",
    allyCode: 123456789,
    name: "Tracked Player",
    level: 85,
    guildId: "guild-id",
    guildName: "Guild",
    stats: [{ nameKey: "STAT_GP", value: 9000000 }],
    arena: { char: { rank: 5, squad: [] }, ship: { rank: 9, squad: [] } },
    datacron: [],
    roster: [
        {
            id: "unit-id",
            defId: "VADER",
            nameKey: "UNIT_VADER_NAME",
            level: 85,
            rarity: 7,
            gear: 13,
            equipped: [{ equipmentId: 1, slot: 0 }],
            skills: [{ id: "basicskill_VADER", tier: 8, tiers: 9 }],
            relic: { currentTier: 9 },
            purchasedAbilityId: ["ultimate_VADER"],
            crew: [],
            combatType: 1,
            mods: [{ id: "mod-id", level: 15, tier: 5, slot: 1, set: 1, pips: 6, primaryStat: {}, secondaryStat: [] }],
        },
        {
            id: "ship-id",
            defId: "TIEADVANCED",
            nameKey: "UNIT_TIEADVANCED_NAME",
            level: 85,
            rarity: 7,
            gear: 1,
            equipped: [],
            skills: [{ id: "basicskill_TIEADVANCED", tier: 8, tiers: 8 }],
            relic: null,
            purchasedAbilityId: [],
            crew: [{ unitId: "VADER", slot: 0 }],
            combatType: 2,
            mods: [],
        },
    ],
} as unknown as SWAPIPlayer;

const tracked = {
    allyCode: 123456789,
    name: "Tracked Player",
    roster: [
        {
            defId: "VADER",
            level: 85,
            rarity: 7,
            gear: 13,
            relic: { currentTier: 9 },
            skills: [{ id: "basicskill_VADER", tier: 8 }],
            purchasedAbilityId: ["ultimate_VADER"],
        },
        {
            defId: "TIEADVANCED",
            level: 85,
            rarity: 7,
            gear: 1,
            relic: null,
            skills: [{ id: "basicskill_TIEADVANCED", tier: 8 }],
            purchasedAbilityId: [],
        },
    ],
};

describe("toTrackedPlayer()", () => {
    it("keeps only what the guild update compares and logs", () => {
        assert.deepStrictEqual(toTrackedPlayer(formatted), tracked);
    });
});

describe("loadStoredTrackedPlayers()", () => {
    let client: MongoClient;
    const rawPlayers = () => client.db(env.MONGODB_SWAPI_DB).collection("rawPlayers");

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
        await rawPlayers().deleteMany({ allyCode: formatted.allyCode });
    });

    after(async () => {
        await rawPlayers().deleteMany({ allyCode: formatted.allyCode });
        await closeMongoClient();
    });

    it("reads a full-shape stored document back as only the tracked fields", async () => {
        await rawPlayers().insertOne({ ...structuredClone(formatted), updatedAt: new Date() });

        assert.deepStrictEqual(await loadStoredTrackedPlayers([formatted.allyCode]), [tracked]);
    });
});
