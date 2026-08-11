import assert from "node:assert";
import { after, describe, it } from "node:test";
import { fetchPlayerData, stripRoster } from "../../modules/workers/getStrippedModsWorker.ts";
import type { ComlinkPlayer } from "../../types/swapi_types.ts";
import { startFakeComlink } from "../helpers/fakeComlink.ts";

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

function makePlayer(units: ReturnType<typeof makeRosterUnit>[]): ComlinkPlayer {
    return { rosterUnit: units } as unknown as ComlinkPlayer;
}

describe("stripRoster", () => {
    it("returns stripped units for a player with mods", () => {
        const result = stripRoster(makePlayer([makeRosterUnit("DARTHVADER", ["mod_speed", "mod_health"])]), MOD_MAP);

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

    it("excludes units with no equipped mods", () => {
        const player = makePlayer([
            makeRosterUnit("DARTHVADER", ["mod_speed"]),
            { definitionId: "LUKESKYWALKER:SEVEN_STAR", equippedStatMod: [] },
        ]);

        const result = stripRoster(player, MOD_MAP);

        assert.strictEqual(result?.length, 1);
        assert.strictEqual(result?.[0].defId, "DARTHVADER");
    });

    it("filters out mods not present in modMap", () => {
        const result = stripRoster(makePlayer([makeRosterUnit("DARTHVADER", ["mod_speed", "mod_unknown"])]), MOD_MAP);

        assert.strictEqual(result?.[0].mods.length, 1);
        assert.strictEqual(result?.[0].mods[0].set, 4);
    });
});

describe("fetchPlayerData", () => {
    it("fetches and strips a player's roster", async () => {
        const comlink = await startFakeComlink(() => ({
            status: 200,
            body: JSON.stringify({ rosterUnit: [makeRosterUnit("DARTHVADER", ["mod_speed"])] }),
        }));
        after(async () => await comlink.close());

        const result = await fetchPlayerData(comlink.url, 123456789, MOD_MAP);

        assert.deepStrictEqual(result, [{ defId: "DARTHVADER", mods: [{ slot: 1, set: 4, primaryStat: 5 }] }]);
    });

    it("sends a signed request to /player, so it works against comlink directly too", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ rosterUnit: [] }) }));
        after(async () => await comlink.close());

        await fetchPlayerData(comlink.url, 123456789, MOD_MAP);

        const headers = comlink.lastHeaders();
        assert.ok(headers["x-date"], "should stamp X-Date");
        assert.match(String(headers.authorization), /^HMAC-SHA256 Credential=/);
        assert.deepStrictEqual(JSON.parse(comlink.lastBody()), { payload: { playerId: "123456789" } });
    });

    // The point of the change: the timeout has to cancel the request, not just stop waiting for it.
    // A request left running holds a socket and a swapiServe slot long after this side gave up.
    it("cancels the request when the timeout fires", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: "{}", delayMs: 5000 }));
        after(async () => await comlink.close());

        await assert.rejects(() => fetchPlayerData(comlink.url, 123456789, MOD_MAP, 50), /timed out after 50ms/);
        assert.strictEqual(comlink.requestCount(), 1, "and does so without re-sending");

        // The server sees the socket close, which is what swapiServe reads as a cancellation.
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.strictEqual(comlink.abandonedCount(), 1, "the upstream request must actually be withdrawn");
    });

    // A player that could not be fetched and a player with no mods must not look the same to the
    // caller. Returning undefined for both let a run where every fetch failed produce a mod
    // aggregate built from nothing and write it over good data, with no count and no log.
    it("rejects when the upstream fails, rather than reporting an empty roster", async () => {
        const comlink = await startFakeComlink(() => ({ status: 502, body: JSON.stringify({ message: "Bad Gateway" }) }));
        after(async () => await comlink.close());

        await assert.rejects(() => fetchPlayerData(comlink.url, 123456789, MOD_MAP), /status 502/);
    });

    it("rejects when the upstream is unreachable", async () => {
        // Port 1 on loopback reliably refuses
        await assert.rejects(() => fetchPlayerData("http://127.0.0.1:1", 123456789, MOD_MAP));
    });

    it("still resolves for a player who genuinely has no modded units", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ rosterUnit: [] }) }));
        after(async () => await comlink.close());

        assert.deepStrictEqual(await fetchPlayerData(comlink.url, 123456789, MOD_MAP), []);
    });

    // The worker used to retry 502/503 twice itself. That retry moved to swapiServe, which sees
    // every call and can pace retries against a shared budget. Keeping both would have stacked
    // multiplicatively: three worker attempts times three service attempts is up to nine upstream
    // calls for one player, amplifying load exactly when the backend is already struggling.
    it("does not retry a 502 itself, leaving retry to swapiServe", async () => {
        const comlink = await startFakeComlink(({ count }) =>
            count === 1
                ? { status: 502, body: JSON.stringify({ message: "Bad Gateway" }) }
                : { status: 200, body: JSON.stringify({ rosterUnit: [makeRosterUnit("DARTHVADER", ["mod_speed"])] }) },
        );
        after(async () => await comlink.close());

        await assert.rejects(() => fetchPlayerData(comlink.url, 123456789, MOD_MAP), "the failure should surface rather than being retried here");
        assert.strictEqual(comlink.requestCount(), 1, "exactly one upstream call per task");
    });

    it("does not leave a pending timeout timer after resolving", async () => {
        const comlink = await startFakeComlink(() => ({ status: 200, body: JSON.stringify({ rosterUnit: [] }) }));
        after(async () => await comlink.close());

        const countTimeouts = () => process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;

        const timersBefore = countTimeouts();
        await fetchPlayerData(comlink.url, 123456789, MOD_MAP, 30_000);
        const timersAfter = countTimeouts();

        assert.strictEqual(timersAfter, timersBefore, "the timeout must not outlive the request that settled");
    });
});
