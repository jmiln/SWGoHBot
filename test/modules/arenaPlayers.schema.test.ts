import assert from "node:assert";
import { describe, it } from "node:test";
import { ArenaPlayerSchema } from "../../schemas/arenaPlayers.schema.ts";

describe("ArenaPlayerSchema", () => {
    it("accepts a full player doc", () => {
        const result = ArenaPlayerSchema.safeParse({
            allyCode: 123456789,
            name: "TestPlayer",
            lastCharRank: 42,
            lastShipRank: 15,
            lastCharClimb: 5,
            lastShipClimb: 2,
            lastCharChange: 3,
            lastShipChange: -1,
            charHist: [{ rank: 42, ts: 1700000000000 }],
            shipHist: [{ rank: 15, ts: 1700000000000 }],
        });
        assert.strictEqual(result.success, true);
    });

    it("accepts a minimal doc with only allyCode and name", () => {
        const result = ArenaPlayerSchema.safeParse({ allyCode: 123456789, name: "Min" });
        assert.strictEqual(result.success, true);
    });

    it("rejects a doc missing allyCode", () => {
        const result = ArenaPlayerSchema.safeParse({ name: "Bad" });
        assert.strictEqual(result.success, false);
    });

    it("rejects a doc missing name", () => {
        const result = ArenaPlayerSchema.safeParse({ allyCode: 123456789 });
        assert.strictEqual(result.success, false);
    });

    it("rejects charHist entries missing rank", () => {
        const result = ArenaPlayerSchema.safeParse({
            allyCode: 1,
            name: "X",
            charHist: [{ ts: 1700000000000 }],
        });
        assert.strictEqual(result.success, false);
    });

    it("rejects charHist entries missing ts", () => {
        const result = ArenaPlayerSchema.safeParse({
            allyCode: 1,
            name: "X",
            charHist: [{ rank: 5 }],
        });
        assert.strictEqual(result.success, false);
    });
});
