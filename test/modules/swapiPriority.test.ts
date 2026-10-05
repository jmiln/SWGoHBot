import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// A priority silently reverting to the default is invisible at runtime until a payout minute
// gets dropped, so the wiring that decides who waits behind whom is asserted here.
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

    it("runs guildsUpdate at the background priority", async () => {
        const source = await readSource("../../modules/patreonFuncs.ts");
        const guildsUpdate = source.slice(source.indexOf("async guildsUpdate("), source.indexOf("async guildTickets("));

        assert.match(guildsUpdate, /PRIORITY\.BACKGROUND/, "guildsUpdate must request the background tier");
    });

    // A "msg" watcher's send window is a few minutes wide, and one small guild fetch must not
    // queue behind guildsUpdate's per-member player fetches in the background tier
    it("runs guildTickets at the supporter priority", async () => {
        const source = await readSource("../../modules/patreonFuncs.ts");
        const start = source.indexOf("async guildTickets(");
        assert.ok(start > 0, "guildTickets should exist");
        const guildTickets = source.slice(start, source.indexOf("\n    }\n", start));

        assert.match(guildTickets, /PRIORITY\.SUPPORTER_COMMAND/, "guildTickets must request the supporter tier");
        assert.doesNotMatch(guildTickets, /PRIORITY\.(BULK|BACKGROUND)/, "guildTickets must not use a background tier");
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

        assert.match(helper, /getCommandAccess\(/, "the shared command path must resolve a caller tier");
    });
});
