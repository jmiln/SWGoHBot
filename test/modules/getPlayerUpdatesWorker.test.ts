import assert from "node:assert";
import { describe, it } from "node:test";
import { Worker } from "node:worker_threads";
import type { SWAPIPlayer, SWAPIUnit } from "../../types/swapi_types.ts";

const WORKER_PATH = `${import.meta.dirname}/../../modules/workers/getPlayerUpdates.ts`;

interface WorkerWrite {
    updateOne: { filter: { allyCode: number }; update: { $set: Partial<SWAPIPlayer> }; upsert?: boolean };
}

function unit(defId: string, level: number): SWAPIUnit {
    return { defId, level, rarity: 7, gear: 12, skills: [], relic: { currentTier: 1 } } as unknown as SWAPIUnit;
}

function player(allyCode: number, roster: SWAPIUnit[]): SWAPIPlayer {
    return { allyCode, name: `Player ${allyCode}`, roster } as unknown as SWAPIPlayer;
}

function runWorker(oldMembers: SWAPIPlayer[], updatedBare: SWAPIPlayer[]): Promise<{ cacheUpdatesOut: WorkerWrite[] }> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData: { oldMembers, updatedBare, specialAbilities: [], chunkIx: 1 } });
        worker.once("message", (msg) => {
            resolve(msg);
            worker.terminate();
        });
        worker.once("error", reject);
    });
}

describe("getPlayerUpdates worker", () => {
    // rawPlayers is aged out on `updated`, so it has to mean "last fetched": a tracked player whose
    // roster sits still must not look stale, or cleanup deletes the baseline /guildupdate diffs against
    it("stamps updated on every fetched player, and rewrites the baseline only when there is news", async () => {
        const UNCHANGED = 111111111;
        const LEVELED = 222222222;
        const NEW = 333333333;
        const before = Date.now();

        const { cacheUpdatesOut } = await runWorker(
            [player(UNCHANGED, [unit("VADER", 85)]), player(LEVELED, [unit("VADER", 84)])],
            [player(UNCHANGED, [unit("VADER", 85)]), player(LEVELED, [unit("VADER", 85)]), player(NEW, [unit("REY", 85)])],
        );

        const writeFor = (allyCode: number) => cacheUpdatesOut.find((w) => w.updateOne.filter.allyCode === allyCode)?.updateOne;
        for (const allyCode of [UNCHANGED, LEVELED, NEW]) {
            const stamped = writeFor(allyCode)?.update.$set.updated;
            assert.ok(typeof stamped === "number" && stamped >= before, `Expected ${allyCode} stamped with a fetch time, got ${stamped}`);
        }

        assert.deepStrictEqual(Object.keys(writeFor(UNCHANGED)?.update.$set ?? {}), ["updated"], "The unchanged baseline is kept");
        assert.ok(!writeFor(UNCHANGED)?.upsert, "A timestamp alone must never create a document");
        assert.strictEqual(writeFor(LEVELED)?.update.$set.roster?.[0].level, 85, "Expected the new baseline saved");
        assert.strictEqual(writeFor(NEW)?.upsert, true, "Expected a first-seen player inserted");
    });
});
