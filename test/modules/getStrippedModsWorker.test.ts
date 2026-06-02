import assert from "node:assert";
import { describe, it } from "node:test";
import { fetchPlayerData } from "../../modules/workers/getStrippedModsWorker.ts";

// mod slots are stored as 2-7 in the API; the worker subtracts 1
const MOD_MAP = {
    mod_speed: { pips: 5, set: "4", slot: 2 },
    mod_health: { pips: 4, set: "1", slot: 3 },
};

function makeRosterUnit(defId: string, modIds: string[]) {
    return {
        definitionId: `${defId}:SEVEN_STAR`,
        equippedStatMod: modIds.map((id) => ({
            definitionId: id,
            primaryStat: { stat: { unitStatId: 5 } },
        })),
    };
}

function makeStub(payload: unknown, delayMs = 0) {
    return {
        getPlayer: (_allyCode: null, _playerId: string) =>
            new Promise<unknown>((resolve) => setTimeout(() => resolve(payload), delayMs)),
    };
}

function makeFailingStub(err: Error, delayMs = 0) {
    return {
        getPlayer: (_allyCode: null, _playerId: string) =>
            new Promise<unknown>((_, reject) => setTimeout(() => reject(err), delayMs)),
    };
}

describe("fetchPlayerData", () => {
    it("returns stripped units for a player with mods", async () => {
        const stub = makeStub({ rosterUnit: [makeRosterUnit("DARTHVADER", ["mod_speed", "mod_health"])] });

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP);

        assert.deepStrictEqual(result, [
            {
                defId: "DARTHVADER",
                mods: [
                    { slot: 1, set: 4, primaryStat: 5 },
                    { slot: 2, set: 1, primaryStat: 5 },
                ],
            },
        ]);
    });

    it("excludes units with no equipped mods", async () => {
        const stub = makeStub({
            rosterUnit: [
                makeRosterUnit("DARTHVADER", ["mod_speed"]),
                { definitionId: "LUKESKYWALKER:SEVEN_STAR", equippedStatMod: [] },
            ],
        });

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP);

        assert.strictEqual(result?.length, 1);
        assert.strictEqual(result?.[0].defId, "DARTHVADER");
    });

    it("filters out mods not present in modMap", async () => {
        const stub = makeStub({
            rosterUnit: [makeRosterUnit("DARTHVADER", ["mod_speed", "mod_unknown"])],
        });

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP);

        assert.strictEqual(result?.[0].mods.length, 1);
        assert.strictEqual(result?.[0].mods[0].set, 4);
    });

    it("returns undefined when request times out", async () => {
        // stub resolves after 200ms; timeout is set to 50ms
        const stub = makeStub({ rosterUnit: [] }, 200);

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 50);

        assert.strictEqual(result, undefined);
    });

    it("returns undefined when comlink throws an error", async () => {
        const stub = makeFailingStub(new Error("Bad Gateway"));

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP);

        assert.strictEqual(result, undefined);
    });

    it("returns undefined when comlink throws an error with a status code", async () => {
        const err = Object.assign(new Error("Bad Gateway"), { status: 502 });
        const stub = makeFailingStub(err);

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP);

        assert.strictEqual(result, undefined);
    });
});
