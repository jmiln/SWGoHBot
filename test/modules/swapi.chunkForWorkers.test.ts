import assert from "node:assert";
import { describe, it } from "node:test";
import { chunkForWorkers } from "../../modules/swapi.ts";
import type { SWAPIPlayer } from "../../types/swapi_types.ts";

const member = (allyCode: number, label: string) => ({ allyCode, name: label }) as unknown as SWAPIPlayer;

describe("chunkForWorkers()", () => {
    it("gives each chunk only the stored docs of its own members", () => {
        const updated = [111111111, 222222222, 333333333, 444444444].map((ac) => member(ac, "fresh"));
        const stored = [444444444, 111111111, 333333333].map((ac) => member(ac, "stored"));

        const chunks = chunkForWorkers(updated, stored, 2);

        assert.deepStrictEqual(
            chunks.map((chunk) => ({
                updated: chunk.updatedBare.map((p) => p.allyCode),
                stored: chunk.oldMembers.map((p) => p.allyCode),
            })),
            [
                { updated: [111111111, 222222222], stored: [111111111] },
                { updated: [333333333, 444444444], stored: [333333333, 444444444] },
            ],
        );
    });

    it("makes no more chunks than there are members", () => {
        const chunks = chunkForWorkers([member(111111111, "fresh")], [], 12);

        assert.strictEqual(chunks.length, 1);
        assert.deepStrictEqual(chunks[0]?.oldMembers, []);
    });

    it("makes no chunks when no member was fetched", () => {
        assert.deepStrictEqual(chunkForWorkers([], [member(111111111, "stored")], 12), []);
    });
});
