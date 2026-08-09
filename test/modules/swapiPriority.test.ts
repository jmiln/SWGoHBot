import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// These assert the wiring that decides who waits behind whom. A priority silently reverting to
// the default would be invisible at runtime until a payout minute got dropped, which is exactly
// the failure this whole service exists to prevent.
describe("comlink call priorities", () => {
    async function readSource(relativePath: string): Promise<string> {
        return await readFile(new URL(relativePath, import.meta.url), "utf8");
    }

    it("runs arenaTick at the top priority", async () => {
        const source = await readSource("../../modules/patreonFuncs.ts");
        const arenaTick = source.slice(source.indexOf("async arenaTick("), source.indexOf("async shardTimes("));

        assert.match(arenaTick, /PRIORITY\.ARENA_TICK/, "arenaTick must request the top tier");
        assert.doesNotMatch(arenaTick, /PRIORITY\.(BULK|BACKGROUND)/, "arenaTick must not use a background tier");
    });

    it("runs the other patreon background jobs at the background priority", async () => {
        const source = await readSource("../../modules/patreonFuncs.ts");

        for (const job of ["async guildsUpdate(", "async guildTickets("]) {
            const start = source.indexOf(job);
            assert.ok(start > 0, `${job} should exist`);
            const body = source.slice(start, start + 6000);
            assert.match(body, /PRIORITY\.BACKGROUND/, `${job} must request the background tier`);
        }
    });

    // dataUpdater cannot use withStub: it threads one stub through a dozen functions, one of
    // which reaches for a private library method. It resolves a bulk-tier stub once instead.
    it("runs dataUpdater at the bulk priority", async () => {
        const source = await readSource("../../services/dataUpdater.ts");

        assert.match(source, /resolveBulkStub\(\)/, "dataUpdater must resolve its stub through swapiQueue");
        assert.doesNotMatch(source, /new ComlinkStub\(/, "and must not build an unqueued stub of its own");
    });

    it("gives the mod worker the base URL dataUpdater resolved", async () => {
        const updater = await readSource("../../services/dataUpdater.ts");
        const worker = await readSource("../../modules/workers/getStrippedModsWorker.ts");

        assert.match(updater, /workerData: \{ comlinkUrl \}/, "the resolved URL must be passed into the pool");
        assert.match(worker, /workerData/, "and the worker must read it rather than deciding for itself");
    });

    // Retry lives in swapiServe now. A second retry loop in the worker would stack with it:
    // three worker attempts times three service attempts is nine upstream calls for one player.
    it("leaves retry to swapiServe rather than retrying inside the mod worker", async () => {
        const worker = await readSource("../../modules/workers/getStrippedModsWorker.ts");

        assert.doesNotMatch(worker, /MAX_RETRIES/, "the worker must not carry its own retry budget");
        assert.match(worker, /PLAYER_FETCH_TIMEOUT_MS/, "but it should keep its per-request timeout");
    });

    it("tiers interactive commands through the shared player helper", async () => {
        const source = await readSource("../../modules/patreonFuncs.ts");
        const helper = source.slice(source.indexOf("export async function fetchPlayerWithCooldown"));

        assert.match(helper, /commandPriority\(/, "the shared command path must resolve a caller tier");
    });
});
