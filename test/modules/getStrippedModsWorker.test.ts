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

// Stub that fails for the first `failCount` calls, then succeeds with `payload`
function makeRetryStub(failCount: number, err: Error, payload: unknown) {
    let calls = 0;
    return {
        calls: () => calls,
        getPlayer: (_allyCode: null, _playerId: string) => {
            calls++;
            if (calls <= failCount) return Promise.reject(err);
            return Promise.resolve(payload);
        },
    };
}

function make502Error() {
    return Object.assign(new Error("Response code 502 (Bad Gateway)"), {
        response: { statusCode: 502 },
    });
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

    it("returns undefined when comlink throws an error with a status code on the error itself", async () => {
        const err = Object.assign(new Error("Bad Gateway"), { status: 502 });
        const stub = makeFailingStub(err);

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000, 0);

        assert.strictEqual(result, undefined);
    });

    it("returns undefined when comlink throws a got-style error with response.statusCode", async () => {
        const stub = makeFailingStub(make502Error());

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000, 0);

        assert.strictEqual(result, undefined);
    });

    // The worker used to retry 502/503 twice itself. That retry moved to swapiServe, which sees
    // every call and can pace retries against a shared budget. Keeping both would have stacked
    // multiplicatively: three worker attempts times three service attempts is up to nine upstream
    // calls for one player, amplifying load exactly when the backend is already struggling.
    it("does not retry a 502 itself, leaving retry to swapiServe", async () => {
        const stub = makeRetryStub(1, make502Error(), { rosterUnit: [makeRosterUnit("DARTHVADER", ["mod_speed"])] });

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000);

        assert.strictEqual(result, undefined, "the failure should surface rather than being retried here");
        assert.strictEqual(stub.calls(), 1, "exactly one upstream call per task");
    });

    it("makes a single call for a persistently failing player", async () => {
        const stub = makeRetryStub(99, make502Error(), null);

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000);

        assert.strictEqual(result, undefined);
        assert.strictEqual(stub.calls(), 1);
    });

    it("does not leave a pending timeout timer after resolving", async () => {
        const countTimeouts = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
        const stub = makeStub({ rosterUnit: [] });

        const before = countTimeouts();
        await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000);
        const after = countTimeouts();

        assert.strictEqual(after, before, "fetchPlayerData should clear its timeout timer once the request settles");
    });

    it("does not retry on non-502 errors", async () => {
        const err = Object.assign(new Error("Not Found"), { response: { statusCode: 404 } });
        const stub = makeRetryStub(99, err, null);

        const result = await fetchPlayerData(stub as never, 123456789, MOD_MAP, 30_000, 0);

        assert.strictEqual(result, undefined);
        assert.strictEqual(stub.calls(), 1);
    });
});
