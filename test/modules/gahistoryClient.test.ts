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

    it("getPlayerIds returns the KYBER list", async () => {
        const { impl } = fakeFetch([{ status: 200, body: { KYBER: ["a", "b"], AURODIUM: ["c"] } }]);
        const client = createGahistoryClient({ fetchImpl: impl, maxPer10s: 100000 });
        assert.deepStrictEqual(await client.getPlayerIds("3v3"), ["a", "b"]);
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
