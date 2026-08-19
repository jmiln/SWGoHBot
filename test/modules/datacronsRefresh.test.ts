import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import { getAllDatacronSets, getDatacronSet, refreshDatacronData } from "../../modules/datacrons.ts";

let dir: string;

async function writeFixtures(setIds: number[], unitMapKeys: string[]): Promise<void> {
    await writeFile(
        path.join(dir, "datacrons.json"),
        JSON.stringify({
            sets: setIds.map((setId) => ({ setId, expirationTimeMs: 0 })),
            abilities: {},
        }),
    );
    await writeFile(path.join(dir, "unitMap.json"), JSON.stringify(Object.fromEntries(unitMapKeys.map((key) => [key, {}]))));
}

before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "datacronsrefresh-"));
});

describe("refreshDatacronData", () => {
    it("replaces the loaded sets", async () => {
        await writeFixtures([1, 2], ["testunit_a"]);

        const counts = await refreshDatacronData(dir);

        assert.deepEqual(
            getAllDatacronSets().map((set) => set.setId),
            [1, 2],
        );
        assert.equal(counts.find((count) => count.label === "datacronSets")?.total, 2);
    });

    it("rebuilds the set index so a removed set is no longer found", async () => {
        await writeFixtures([1, 2], ["testunit_a"]);
        await refreshDatacronData(dir);

        await writeFixtures([3], ["testunit_a"]);
        await refreshDatacronData(dir);

        assert.deepEqual(
            getAllDatacronSets().map((set) => set.setId),
            [3],
            "the setsById index must be rebuilt, not appended to",
        );
        assert.equal(getDatacronSet(1), null, "a set dropped from the file must no longer resolve");
    });

    it("leaves state untouched when a file fails to parse", async () => {
        await writeFixtures([9], ["testunit_a"]);
        await refreshDatacronData(dir);

        await writeFile(path.join(dir, "unitMap.json"), '{"truncated": ');
        await assert.rejects(refreshDatacronData(dir));

        assert.deepEqual(
            getAllDatacronSets().map((set) => set.setId),
            [9],
        );
    });
});
