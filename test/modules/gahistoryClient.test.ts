import assert from "node:assert";
import { describe, it } from "node:test";
import { createGahistoryClient } from "../../modules/counters/gahistoryClient.ts";

function fakeFetch(script: Array<{ status: number; body?: unknown }>) {
    let i = 0;
    const calls: string[] = [];
    const impl = async (url: string) => {
        calls.push(url);
        const step = script[Math.min(i++, script.length - 1)];
        return { ok: step.status >= 200 && step.status < 300, status: step.status, json: async () => step.body ?? {} };
    };
    return { impl, calls };
}

describe("gahistoryClient", () => {
    it("getInfo returns parsed instanceId/season", async () => {
        const { impl } = fakeFetch([{ status: 200, body: { instanceId: "O1", season: 80, eventInstanceId: "E:O1" } }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.deepStrictEqual(await client.getInfo("5v5"), { instanceId: "O1", season: 80, eventInstanceId: "E:O1" });
    });

    it("getPlayerIds gathers every ingested league, not just KYBER", async () => {
        const { impl } = fakeFetch([
            { status: 200, body: { KYBER: ["a", "b"], AURODIUM: ["c"], CHROMIUM: ["d"], BRONZIUM: ["e"], CARBONITE: ["z"] } },
        ]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.deepStrictEqual(await client.getPlayerIds("3v3"), ["a", "b", "c", "d", "e"]);
    });

    it("getPlayerIds skips CARBONITE (AFK-heavy, so its teams pollute win rates)", async () => {
        const { impl } = fakeFetch([{ status: 200, body: { KYBER: ["a"], CARBONITE: ["afk1", "afk2"] } }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        const ids = await client.getPlayerIds("5v5");
        assert.deepStrictEqual(ids, ["a"]);
        assert.ok(!ids.includes("afk1"));
    });

    it("getPlayerIds tolerates a missing league and de-duplicates ids", async () => {
        const { impl } = fakeFetch([{ status: 200, body: { KYBER: ["a", "dup"], BRONZIUM: ["dup", "b"] } }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.deepStrictEqual(await client.getPlayerIds("5v5"), ["a", "dup", "b"]);
    });

    it("getPlayerIds returns an empty list when the payload has no leagues", async () => {
        const { impl } = fakeFetch([{ status: 200, body: {} }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.deepStrictEqual(await client.getPlayerIds("5v5"), []);
    });

    it("getPlayer retries on 5xx then succeeds", async () => {
        const { impl, calls } = fakeFetch([{ status: 500 }, { status: 200, body: { matchResult: [] } }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        const doc = await client.getPlayer("5v5", "abc");
        assert.deepStrictEqual(doc, { matchResult: [] });
        assert.strictEqual(calls.length, 2);
    });

    it("getPlayer returns null on 404", async () => {
        const { impl } = fakeFetch([{ status: 404 }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.strictEqual(await client.getPlayer("5v5", "missing"), null);
    });

    it("getPlayer throws after exhausting retries on persistent 5xx", async () => {
        const { impl, calls } = fakeFetch([{ status: 500 }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        await assert.rejects(() => client.getPlayer("5v5", "abc"));
        assert.strictEqual(calls.length, 4);
    });
});
