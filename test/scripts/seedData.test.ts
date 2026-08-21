import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { seedMissingFiles } from "../../scripts/seedData.ts";

let source: string;
let dest: string;

beforeEach(async () => {
    source = await mkdtemp(path.join(tmpdir(), "seed-src-"));
    dest = await mkdtemp(path.join(tmpdir(), "seed-dest-"));
});

describe("seedMissingFiles", () => {
    it("copies every file into an empty destination", async () => {
        await writeFile(path.join(source, "characters.json"), '["char"]');
        await writeFile(path.join(source, "acronyms.json"), '{"AA":"Admiral Ackbar"}');

        const result = await seedMissingFiles(source, dest);

        assert.deepEqual(result.seeded.sort(), ["acronyms.json", "characters.json"]);
        assert.equal(result.kept, 0);
        assert.equal(await readFile(path.join(dest, "characters.json"), "utf-8"), '["char"]');
    });

    // The destination is the live data dir: dataUpdater's fresher output must never be replaced by
    // the older copy baked into the image.
    it("leaves an existing file untouched even when the contents differ", async () => {
        await writeFile(path.join(source, "characters.json"), '["stale from image"]');
        await writeFile(path.join(dest, "characters.json"), '["fresh from dataUpdater"]');

        const result = await seedMissingFiles(source, dest);

        assert.deepEqual(result.seeded, []);
        assert.equal(result.kept, 1);
        assert.equal(await readFile(path.join(dest, "characters.json"), "utf-8"), '["fresh from dataUpdater"]');
    });

    it("seeds a file added to the source later, alongside existing ones", async () => {
        await writeFile(path.join(source, "characters.json"), '["char"]');
        await writeFile(path.join(source, "factionNames.json"), '{"species_wookiee":{"eng_us":"Wookiee"}}');
        await writeFile(path.join(dest, "characters.json"), '["char"]');

        const result = await seedMissingFiles(source, dest);

        assert.deepEqual(result.seeded, ["factionNames.json"]);
        assert.equal(result.kept, 1);
    });

    it("recreates nested directories", async () => {
        await mkdir(path.join(source, "constants"), { recursive: true });
        await writeFile(path.join(source, "constants", "units.ts"), "export const characters = [];");

        const result = await seedMissingFiles(source, dest);

        assert.deepEqual(result.seeded, ["constants/units.ts"]);
        assert.equal(await readFile(path.join(dest, "constants", "units.ts"), "utf-8"), "export const characters = [];");
    });

    it("descends into a directory that exists on both sides", async () => {
        await mkdir(path.join(source, "constants"), { recursive: true });
        await mkdir(path.join(dest, "constants"), { recursive: true });
        await writeFile(path.join(source, "constants", "units.ts"), "a");
        await writeFile(path.join(source, "constants", "swapiServe.ts"), "b");
        await writeFile(path.join(dest, "constants", "units.ts"), "kept");

        const result = await seedMissingFiles(source, dest);

        assert.deepEqual(result.seeded, ["constants/swapiServe.ts"]);
        assert.equal(result.kept, 1);
        assert.equal(await readFile(path.join(dest, "constants", "units.ts"), "utf-8"), "kept");
    });
});
