import assert from "node:assert";
import { describe, it } from "node:test";
import { summarizeDroppedMembers } from "../../modules/swapi.ts";

const RPC_CONTEXT = "[400] IllegalStateException: RPC Context not setup or doesn't hold a playerId.";

describe("summarizeDroppedMembers", () => {
    it("returns null when nothing was dropped", () => {
        assert.strictEqual(summarizeDroppedMembers([], 50), null);
    });

    it("reports the dropped count against the roster size", () => {
        const summary = summarizeDroppedMembers([{ playerId: "abc", detail: RPC_CONTEXT }], 50);

        assert.ok(summary?.startsWith("dropped 1/50 members: "), summary ?? "null");
    });

    // The whole point of the summary: the per-player logging it replaces was throttled to one line
    // a minute, so a guild that lost three members to the same upstream rejection logged one.
    it("groups members that failed for the same reason into one entry", () => {
        const summary = summarizeDroppedMembers(
            [
                { playerId: "aaa", detail: RPC_CONTEXT },
                { playerId: "bbb", detail: RPC_CONTEXT },
                { playerId: "ccc", detail: RPC_CONTEXT },
            ],
            44,
        );

        assert.strictEqual(summary, `dropped 3/44 members: ${RPC_CONTEXT} (3: aaa, bbb, ccc)`);
    });

    it("keeps distinct reasons apart", () => {
        const summary = summarizeDroppedMembers(
            [
                { playerId: "aaa", detail: RPC_CONTEXT },
                { playerId: "bbb", detail: "[500] upstream boom" },
                { playerId: "ccc", detail: RPC_CONTEXT },
            ],
            50,
        );

        assert.strictEqual(summary, `dropped 3/50 members: ${RPC_CONTEXT} (2: aaa, ccc); [500] upstream boom (1: bbb)`);
    });

    // A guild-wide outage would otherwise put 50 ids on one line. The count stays exact so the
    // line is still countable against "Missing players, only getting X/Y".
    it("caps the listed ids but keeps the full count", () => {
        const dropped = ["a", "b", "c", "d", "e", "f", "g"].map((playerId) => ({ playerId, detail: RPC_CONTEXT }));

        const summary = summarizeDroppedMembers(dropped, 50);

        assert.strictEqual(summary, `dropped 7/50 members: ${RPC_CONTEXT} (7: a, b, c, d, e, ...)`);
    });
});
