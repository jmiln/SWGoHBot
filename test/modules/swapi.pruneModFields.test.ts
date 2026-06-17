import assert from "node:assert";
import { describe, it } from "node:test";
import { pruneModFields } from "../../modules/swapi.ts";
import type { SWAPIMod } from "../../types/swapi_types.ts";

// The statcalc service returns mods carrying raw game-economy fields
// (sellValue, removeCost, levelCost, xp, locked, bonusQuantity, convertedItem,
// rerolledCount) that nothing in the bot reads. They were being persisted to
// playerStats verbatim via `$set: bareP`, accounting for ~31% of each player
// document. pruneModFields reduces a mod down to only the SWAPIMod fields the
// bot actually stores and consumes.
describe("swapi.pruneModFields", () => {
    const rawMod = {
        // Dead-weight fields that must be dropped
        sellValue: { currency: 1, quantity: "97200", bonusQuantity: 0 },
        removeCost: { currency: 1, quantity: "4750", bonusQuantity: 0 },
        levelCost: { currency: 1, quantity: "0", bonusQuantity: 0 },
        locked: false,
        xp: 486000,
        bonusQuantity: 0,
        convertedItem: null,
        rerolledCount: 0,
        // Fields the bot uses, that must be kept
        id: "DbPKNBoaTiecH-QJqNzejA",
        level: 15,
        tier: 2,
        slot: 1,
        set: 4,
        pips: 5,
        primaryStat: { unitStat: 48, value: 5.88 },
        secondaryStat: [
            { unitStat: 1, value: 679, roll: 2 },
            { unitStat: 49, value: 0.911, roll: 1 },
        ],
    } as unknown as SWAPIMod;

    it("keeps only the whitelisted SWAPIMod fields", () => {
        const pruned = pruneModFields(rawMod);

        assert.deepStrictEqual(Object.keys(pruned).sort(), [
            "id",
            "level",
            "pips",
            "primaryStat",
            "secondaryStat",
            "set",
            "slot",
            "tier",
        ]);
    });

    it("drops the unused raw game-economy fields", () => {
        const pruned = pruneModFields(rawMod) as unknown as Record<string, unknown>;

        for (const dead of ["sellValue", "removeCost", "levelCost", "locked", "xp", "bonusQuantity", "convertedItem", "rerolledCount"]) {
            assert.strictEqual(pruned[dead], undefined, `${dead} should be dropped`);
        }
    });

    it("preserves the values of the kept fields verbatim", () => {
        const pruned = pruneModFields(rawMod);

        assert.strictEqual(pruned.id, "DbPKNBoaTiecH-QJqNzejA");
        assert.strictEqual(pruned.level, 15);
        assert.strictEqual(pruned.pips, 5);
        assert.deepStrictEqual(pruned.primaryStat, { unitStat: 48, value: 5.88 });
        assert.deepStrictEqual(pruned.secondaryStat, [
            { unitStat: 1, value: 679, roll: 2 },
            { unitStat: 49, value: 0.911, roll: 1 },
        ]);
    });
});
