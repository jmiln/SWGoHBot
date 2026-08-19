import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import {
    allUnitsList,
    characterNameList,
    characters,
    factions,
    journeyReqs,
    omicrons,
    raidNames,
    refreshUnitData,
    shipNameList,
    ships,
    unitNames,
} from "../../data/constants/units.ts";
import type { BotUnit } from "../../types/types.ts";

let dir: string;
let baseChar: BotUnit;
let baseShip: BotUnit;

/** Write a full set of the eight live files, so every refresh has something valid to read. */
async function writeFixtures(chars: BotUnit[], shipList: BotUnit[], extra: Record<string, unknown> = {}): Promise<void> {
    const files: Record<string, unknown> = {
        "characters.json": chars,
        "ships.json": shipList,
        "charLocations.json": [],
        "shipLocations.json": [],
        "journeyReqs.json": { TESTJOURNEY: [] },
        "omicrons.json": { testcat: [] },
        "raidNames.json": { testraid: { eng_us: "Test Raid" } },
        "unitNames.json": { TESTUNIT_A: { eng_us: "Test Unit A" } },
        ...extra,
    };
    for (const [name, contents] of Object.entries(files)) {
        await writeFile(path.join(dir, name), typeof contents === "string" ? contents : JSON.stringify(contents));
    }
}

before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "unitsrefresh-"));
    // Clone real entries so the fixtures satisfy BotUnit without restating its shape here.
    baseChar = structuredClone(characters[0]);
    baseShip = structuredClone(ships[0]);
});

describe("refreshUnitData", () => {
    it("adds, updates and removes units, and preserves identity for units present in both", async () => {
        await writeFixtures(
            [
                { ...baseChar, uniqueName: "TESTUNIT_A", name: "Test Unit A", factions: ["Test Faction"] },
                { ...baseChar, uniqueName: "TESTUNIT_B", name: "Test Unit B", factions: ["Test Faction"] },
            ],
            [{ ...baseShip, uniqueName: "TESTSHIP_A", name: "Test Ship A", factions: ["Test Faction"] }],
        );
        await refreshUnitData(dir);
        const keptReference = characters.find((unit) => unit.uniqueName === "TESTUNIT_A");
        assert.ok(keptReference, "TESTUNIT_A should exist after the first refresh");

        await writeFixtures(
            [
                { ...baseChar, uniqueName: "TESTUNIT_A", name: "Test Unit A Renamed", factions: ["Test Faction"] },
                { ...baseChar, uniqueName: "TESTUNIT_C", name: "Test Unit C", factions: ["Test Faction"] },
            ],
            [{ ...baseShip, uniqueName: "TESTSHIP_A", name: "Test Ship A", factions: ["Test Faction"] }],
        );
        const counts = await refreshUnitData(dir);

        const names = characters.map((unit) => unit.uniqueName);
        assert.deepEqual(names.sort(), ["TESTUNIT_A", "TESTUNIT_C"]);
        assert.equal(keptReference.name, "Test Unit A Renamed", "an existing unit object must be updated in place");
        const charCount = counts.find((count) => count.label === "characters");
        assert.deepEqual(
            { added: charCount?.added, removed: charCount?.removed, updated: charCount?.updated },
            { added: 1, removed: 1, updated: 1 },
        );
    });

    it("rebuilds derived values so a new unit is visible through them", async () => {
        await writeFixtures(
            [{ ...baseChar, uniqueName: "TESTUNIT_D", name: "Test Unit D", factions: ["Brand New Faction"] }],
            [{ ...baseShip, uniqueName: "TESTSHIP_B", name: "Test Ship B", factions: ["Test Faction"] }],
        );

        await refreshUnitData(dir);

        assert.ok(
            allUnitsList.some((unit) => unit.uniqueName === "TESTUNIT_D"),
            "allUnitsList is a copy and must be rebuilt explicitly",
        );
        assert.ok(factions.includes("Brand New Faction"));
        assert.ok(characterNameList.some((entry) => entry.defId === "TESTUNIT_D"));
        assert.ok(shipNameList.some((entry) => entry.defId === "TESTSHIP_B"));
    });

    it("replaces record-shaped data in place", async () => {
        await writeFixtures([{ ...baseChar, uniqueName: "TESTUNIT_E", name: "E", factions: [] }], [], {
            "raidNames.json": { onlyraid: { eng_us: "Only Raid" } },
            "omicrons.json": { onlycat: [] },
            "unitNames.json": { TESTUNIT_E: { eng_us: "E" } },
            "journeyReqs.json": { ONLYJOURNEY: [] },
        });

        await refreshUnitData(dir);

        assert.deepEqual(Object.keys(raidNames), ["onlyraid"], "stale keys must be deleted, not merged over");
        assert.deepEqual(Object.keys(omicrons), ["onlycat"]);
        assert.deepEqual(Object.keys(unitNames), ["TESTUNIT_E"]);
        assert.deepEqual(Object.keys(journeyReqs), ["ONLYJOURNEY"]);
    });

    it("leaves every dataset untouched when one file fails to parse", async () => {
        await writeFixtures([{ ...baseChar, uniqueName: "TESTUNIT_F", name: "F", factions: [] }], [], {
            "raidNames.json": { keptraid: { eng_us: "Kept Raid" } },
        });
        await refreshUnitData(dir);

        await writeFixtures([{ ...baseChar, uniqueName: "TESTUNIT_G", name: "G", factions: [] }], [], {
            "raidNames.json": '{"truncated": ',
        });
        await assert.rejects(refreshUnitData(dir));

        assert.deepEqual(
            characters.map((unit) => unit.uniqueName),
            ["TESTUNIT_F"],
            "a parse failure anywhere must abort before any dataset is applied",
        );
        assert.deepEqual(Object.keys(raidNames), ["keptraid"]);
    });

    it("tolerates unitNames.json being absent, as it is before dataUpdater's first run", async () => {
        await writeFixtures([{ ...baseChar, uniqueName: "TESTUNIT_H", name: "H", factions: [] }], []);
        await rm(path.join(dir, "unitNames.json"));

        await refreshUnitData(dir);

        assert.deepEqual(Object.keys(unitNames), []);
    });
});
