import assert from "node:assert";
import { describe, it } from "node:test";
import dataUpdater from "../../services/dataUpdater.ts";

const {
    foldUnitMods,
    processAbilities,
    processCategories,
    processEquipment,
    processMaterials,
    processModData,
    processModResults,
    processRecipes,
    processUnits,
    unitsToCharacterDB,
    unitsForUnitMapFile,
} = dataUpdater;

// ---------------------------------------------------------------------------
// processCategories
// ---------------------------------------------------------------------------

describe("processCategories", () => {
    it("includes visible categories", () => {
        const result = processCategories([{ id: "faction_jedi", descKey: "Jedi", visible: true }] as any);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].id, "faction_jedi");
    });

    it("includes non-visible alignment categories", () => {
        const result = processCategories([{ id: "alignment_light", descKey: "Light Side", visible: false }] as any);
        assert.strictEqual(result.length, 1);
    });

    it("excludes non-visible non-alignment categories", () => {
        const result = processCategories([{ id: "faction_hidden", descKey: "Hidden", visible: false }] as any);
        assert.strictEqual(result.length, 0);
    });

    it("maps to only id and descKey", () => {
        const result = processCategories([{ id: "role_attacker", descKey: "Attacker", visible: true, extra: "ignored" }] as any);
        assert.deepStrictEqual(result[0], { id: "role_attacker", descKey: "Attacker" });
    });

    it("returns empty array for empty input", () => {
        assert.deepStrictEqual(processCategories([]), []);
    });
});

// ---------------------------------------------------------------------------
// processEquipment
// ---------------------------------------------------------------------------

describe("processEquipment", () => {
    it("maps to id, nameKey, recipeId, mark", () => {
        const input = [{ id: "gear1", nameKey: "GEAR_1", recipeId: "recipe1", mark: "Mk1", extra: "ignored" }];
        const result = processEquipment(input as any);
        assert.deepStrictEqual(result[0], { id: "gear1", nameKey: "GEAR_1", recipeId: "recipe1", mark: "Mk1" });
    });

    it("returns empty array for empty input", () => {
        assert.deepStrictEqual(processEquipment([]), []);
    });
});

// ---------------------------------------------------------------------------
// processModData
// ---------------------------------------------------------------------------

describe("processModData", () => {
    it("maps mod definitions to pips/set/slot by id", () => {
        const input = [{ id: "mod1", rarity: 5, setId: "1", slot: 2 }];
        const result = processModData(input as any);
        assert.deepStrictEqual(result["mod1"], { pips: 5, set: "1", slot: 2 });
    });

    it("handles multiple mods", () => {
        const input = [
            { id: "modA", rarity: 5, setId: "1", slot: 2 },
            { id: "modB", rarity: 6, setId: "3", slot: 4 },
        ];
        const result = processModData(input as any);
        assert.strictEqual(Object.keys(result).length, 2);
        assert.deepStrictEqual(result["modB"], { pips: 6, set: "3", slot: 4 });
    });

    it("returns empty object for empty input", () => {
        assert.deepStrictEqual(processModData([]), {});
    });
});

// ---------------------------------------------------------------------------
// processMaterials
// ---------------------------------------------------------------------------

describe("processMaterials", () => {
    it("ignores materials that don't start with unitshard", () => {
        const input = [{ id: "gear_GEAR1", iconKey: "tex.gear1", lookupMission: [], raidLookup: [] }];
        const { unitShardList, bulkMatArr } = processMaterials(input as any);
        assert.strictEqual(unitShardList.length, 0);
        assert.strictEqual(bulkMatArr.length, 0);
    });

    it("includes unitshard materials in both outputs", () => {
        const input = [{ id: "unitshard_VADER", iconKey: "tex.vader_i", lookupMission: [], raidLookup: [] }];
        const { unitShardList, bulkMatArr } = processMaterials(input as any);
        assert.strictEqual(unitShardList.length, 1);
        assert.strictEqual(bulkMatArr.length, 1);
    });

    it("strips tex. prefix from iconKey in unitShardList", () => {
        const input = [{ id: "unitshard_VADER", iconKey: "tex.vader_i", lookupMission: [], raidLookup: [] }];
        const { unitShardList } = processMaterials(input as any);
        assert.strictEqual(unitShardList[0].iconKey, "vader_i");
    });

    it("maps lookupMissionList from missionIdentifier", () => {
        const input = [
            {
                id: "unitshard_VADER",
                iconKey: "tex.vader_i",
                lookupMission: [{ missionIdentifier: { campaignId: "C1" } }, { missionIdentifier: { campaignId: "C2" } }],
                raidLookup: [],
            },
        ];
        const { bulkMatArr } = processMaterials(input as any);
        assert.strictEqual(bulkMatArr[0].updateOne.update.$set.lookupMissionList.length, 2);
    });
});

// ---------------------------------------------------------------------------
// processRecipes
// ---------------------------------------------------------------------------

describe("processRecipes", () => {
    it("filters out GRIND ingredients", () => {
        const input = [{ id: "r1", descKey: "Recipe1", ingredients: [{ id: "GRIND", count: 1 }, { id: "unitshard_VADER", count: 5 }] }];
        const { mappedRecipeList } = processRecipes(input as any);
        assert.strictEqual(mappedRecipeList[0].ingredients.length, 1);
        assert.strictEqual(mappedRecipeList[0].ingredients[0].id, "unitshard_VADER");
    });

    it("adds unit shard recipes to unitRecipeList", () => {
        const input = [{ id: "r1", descKey: "Recipe1", ingredients: [{ id: "unitshard_VADER", count: 5 }] }];
        const { unitRecipeList } = processRecipes(input as any);
        assert.strictEqual(unitRecipeList.length, 1);
        assert.strictEqual(unitRecipeList[0].unitShard, "unitshard_VADER");
    });

    it("does not add to unitRecipeList when no unitshard ingredient", () => {
        const input = [{ id: "r1", descKey: "Recipe1", ingredients: [{ id: "gear1", count: 1 }] }];
        const { unitRecipeList } = processRecipes(input as any);
        assert.strictEqual(unitRecipeList.length, 0);
    });

    it("returns empty lists for empty input", () => {
        const { mappedRecipeList, unitRecipeList } = processRecipes([]);
        assert.strictEqual(mappedRecipeList.length, 0);
        assert.strictEqual(unitRecipeList.length, 0);
    });
});

// ---------------------------------------------------------------------------
// processUnits
// ---------------------------------------------------------------------------

const makeRawUnit = (overrides = {}) => ({
    baseId: "VADER",
    nameKey: "UNIT_VADER",
    rarity: 7,
    obtainable: true,
    obtainableTime: 0,
    skillReference: [],
    categoryId: [],
    combatType: 1,
    unitTier: [],
    crew: [],
    creationRecipeReference: "recipe_vader",
    legend: false,
    ...overrides,
});

describe("processUnits", () => {
    it("includes units with rarity 7, obtainable, obtainableTime 0", () => {
        const result = processUnits([makeRawUnit()] as any);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].baseId, "VADER");
    });

    it("includes units with string obtainableTime '0'", () => {
        const result = processUnits([makeRawUnit({ obtainableTime: "0" })] as any);
        assert.strictEqual(result.length, 1);
    });

    it("excludes units with rarity less than 7", () => {
        const result = processUnits([makeRawUnit({ rarity: 6 })] as any);
        assert.strictEqual(result.length, 0);
    });

    it("excludes non-obtainable units", () => {
        const result = processUnits([makeRawUnit({ obtainable: false })] as any);
        assert.strictEqual(result.length, 0);
    });

    it("excludes units with non-zero obtainableTime", () => {
        const result = processUnits([makeRawUnit({ obtainableTime: 99999 })] as any);
        assert.strictEqual(result.length, 0);
    });

    it("maps fields correctly", () => {
        const result = processUnits([makeRawUnit()] as any);
        assert.strictEqual(result[0].nameKey, "UNIT_VADER");
        assert.strictEqual(result[0].combatType, 1);
        assert.strictEqual(result[0].creationRecipeReference, "recipe_vader");
    });
});

// ---------------------------------------------------------------------------
// processAbilities
// ---------------------------------------------------------------------------

describe("processAbilities", () => {
    const makeAbility = (id: string, overrides = {}) => ({
        id,
        nameKey: `${id}_NAME`,
        descKey: `${id}_DESC`,
        abilityType: "basicskill",
        cooldown: 0,
        tier: [{ descKey: `${id}_TIER1_DESC` }, { descKey: `${id}_TIER2_DESC` }],
        ...overrides,
    });

    const makeSkill = (abilityReference: string, tiers: string[]) => ({
        id: `skill_${abilityReference}`,
        abilityReference,
        tier: tiers.map((recipeId) => ({ recipeId })),
    });

    it("matches abilities to skills by abilityReference", () => {
        const abilities = [makeAbility("ability1")] as any;
        const skills = [makeSkill("ability1", ["RECIPE_T1", "RECIPE_T2"])] as any;
        const { abilitiesOut } = processAbilities(abilities, skills);
        assert.strictEqual(abilitiesOut.length, 1);
        assert.strictEqual(abilitiesOut[0].id, "ability1");
    });

    it("skips abilities with no matching skill", () => {
        const abilities = [makeAbility("ability_orphan")] as any;
        const { abilitiesOut } = processAbilities(abilities, []);
        assert.strictEqual(abilitiesOut.length, 0);
    });

    it("detects zeta tier", () => {
        const abilities = [makeAbility("ab1")] as any;
        const skills = [makeSkill("ab1", ["RECIPE_T1", "RECIPE_T2_ZETA"])] as any;
        const { abilitiesOut } = processAbilities(abilities, skills);
        assert.strictEqual(abilitiesOut[0].isZeta, true);
        assert.strictEqual(abilitiesOut[0].zetaTier, 2);
    });

    it("detects omicron tier", () => {
        const abilities = [makeAbility("ab1")] as any;
        const skills = [makeSkill("ab1", ["RECIPE_T1", "RECIPE_T2_ZETA", "RECIPE_T3_OMICRON"])] as any;
        const { abilitiesOut } = processAbilities(abilities, skills);
        assert.strictEqual(abilitiesOut[0].isOmicron, true);
        assert.strictEqual(abilitiesOut[0].omicronTier, 3);
    });

    it("does not flag as zeta/omicron when no matching suffix", () => {
        const abilities = [makeAbility("ab1")] as any;
        const skills = [makeSkill("ab1", ["RECIPE_T1", "RECIPE_T2"])] as any;
        const { abilitiesOut } = processAbilities(abilities, skills);
        assert.strictEqual(abilitiesOut[0].isZeta, false);
        assert.strictEqual(abilitiesOut[0].isOmicron, false);
    });

    it("populates skillMap keyed by skill id", () => {
        const abilities = [makeAbility("ab1")] as any;
        const skills = [makeSkill("ab1", ["RECIPE_T1", "RECIPE_T2_ZETA"])] as any;
        const { skillMap } = processAbilities(abilities, skills);
        assert.ok(skillMap["skill_ab1"]);
        assert.strictEqual(skillMap["skill_ab1"].isZeta, true);
        assert.strictEqual(skillMap["skill_ab1"].tiers, 2);
    });

    it("uses last ability tier as descKey", () => {
        const ability = makeAbility("ab1");
        const skills = [makeSkill("ab1", ["RECIPE_T1"])] as any;
        const { abilitiesOut } = processAbilities([ability] as any, skills);
        assert.strictEqual(abilitiesOut[0].descKey, "ab1_TIER2_DESC");
    });
});

// ---------------------------------------------------------------------------
// processModResults
// ---------------------------------------------------------------------------

describe("processModResults", () => {
    it("picks the most common primary string", () => {
        const input = {
            VADER: {
                primaries: { "1-5_2-17_3-18_4-5_5-28_6-41": 100, "1-5_2-14_3-18_4-5_5-28_6-41": 5 },
                sets: { "2x1_4x3": 80 },
            },
        };
        const result = processModResults(input);
        // Most common primary is the one with count 100
        assert.ok(result["VADER"].mods["square"], "Expected square slot to be set");
        assert.strictEqual(result["VADER"].mods["square"], "Speed"); // stat 5 = Speed
        assert.strictEqual(result["VADER"].mods["arrow"], "Potency"); // stat 17 = Potency
    });

    it("maps set string to readable format", () => {
        const input = {
            VADER: {
                primaries: { "1-5": 1 },
                sets: { "2x1": 1 }, // 2x Health
            },
        };
        const result = processModResults(input);
        assert.ok(result["VADER"].mods.sets.includes("Health x2"), `Expected 'Health x2', got ${JSON.stringify(result["VADER"].mods.sets)}`);
    });

    it("expands multi-mod sets", () => {
        const input = {
            VADER: {
                primaries: { "1-5": 1 },
                sets: { "4x5": 1 }, // 4x Crit. Chance
            },
        };
        const result = processModResults(input);
        // "Crit. Chance x4" should expand to two "Crit. Chance x2"
        assert.strictEqual(result["VADER"].mods.sets.length, 2);
        assert.ok(result["VADER"].mods.sets.every((s: string) => s === "Crit. Chance x2"));
    });

    it("handles multiple units independently", () => {
        const input = {
            VADER: { primaries: { "1-5": 10 }, sets: { "2x1": 10 } },
            LUKE: { primaries: { "1-5": 5 }, sets: { "2x4": 5 } },
        };
        const result = processModResults(input);
        assert.ok(result["VADER"]);
        assert.ok(result["LUKE"]);
    });
});

// ---------------------------------------------------------------------------
// foldUnitMods
// ---------------------------------------------------------------------------

describe("foldUnitMods", () => {
    it("folds a single unit's mods into primary and set strings", () => {
        const acc = {};
        foldUnitMods(acc, [
            {
                defId: "VADER",
                mods: [
                    { slot: 0, set: 1, primaryStat: 5 },
                    { slot: 1, set: 1, primaryStat: 17 },
                ],
            },
        ] as any);
        // Primary string uses 1-based mod index, not slot: "1-5_2-17"
        assert.deepStrictEqual(acc, {
            VADER: {
                primaries: { "1-5_2-17": 1 },
                sets: { "2x1": 1 }, // two mods of set 1
            },
        });
    });

    it("accumulates counts across separate calls (streaming equivalence)", () => {
        const acc = {};
        const player = [
            {
                defId: "VADER",
                mods: [
                    { slot: 0, set: 1, primaryStat: 5 },
                    { slot: 1, set: 1, primaryStat: 17 },
                ],
            },
        ];
        // Folding two players one at a time must equal folding both together
        foldUnitMods(acc, player as any);
        foldUnitMods(acc, player as any);
        assert.strictEqual((acc as any).VADER.primaries["1-5_2-17"], 2);
        assert.strictEqual((acc as any).VADER.sets["2x1"], 2);
    });

    it("skips units with no mods", () => {
        const acc = {};
        foldUnitMods(acc, [{ defId: "EMPTY", mods: [] }] as any);
        assert.deepStrictEqual(acc, {});
    });

    it("returns the same accumulator it was given", () => {
        const acc = {};
        const result = foldUnitMods(acc, [] as any);
        assert.strictEqual(result, acc);
    });
});

// ---------------------------------------------------------------------------
// unitsToCharacterDB
// ---------------------------------------------------------------------------

describe("unitsToCharacterDB", () => {
    const makeProcessedUnit = (overrides = {}) => ({
        baseId: "VADER",
        nameKey: "UNIT_VADER",
        skillReferenceList: [],
        categoryIdList: ["alignment_dark", "affiliation_sithempire", "profession_attacker"],
        combatType: 1,
        unitTierList: [],
        crewList: [],
        creationRecipeReference: "recipe_vader",
        legend: false,
        ...overrides,
    });

    it("produces a bulk upsert operation per unit", () => {
        const result = unitsToCharacterDB([makeProcessedUnit()] as any);
        assert.strictEqual(result.length, 1);
        assert.ok(result[0].updateOne);
        assert.ok(result[0].updateOne.upsert);
    });

    it("filters categories using catList prefixes", () => {
        const unit = makeProcessedUnit({
            categoryIdList: ["alignment_dark", "affiliation_sithempire", "role_attacker", "unrelated_something"],
        });
        const result = unitsToCharacterDB([unit] as any);
        const factions = result[0].updateOne.update.$set.factions as string[];
        // "unrelated_something" should not appear
        assert.ok(!factions.some((f: string) => f.toLowerCase().includes("something")));
    });

    it("applies factionMap to known faction keys", () => {
        const unit = makeProcessedUnit({ categoryIdList: ["affiliation_sithempire"] });
        const result = unitsToCharacterDB([unit] as any);
        const factions = result[0].updateOne.update.$set.factions as string[];
        assert.ok(factions.includes("Sith Empire"), `Expected 'Sith Empire', got ${JSON.stringify(factions)}`);
    });

    it("skips units in the ignoreSet", () => {
        const unit = makeProcessedUnit({ categoryIdList: ["affiliation_capital"] });
        const result = unitsToCharacterDB([unit] as any);
        const factions = result[0].updateOne.update.$set.factions as string[];
        assert.ok(!factions.includes("Capital"), "Expected 'capital' to be ignored");
    });

    it("extracts crew unit IDs from crewList", () => {
        const unit = makeProcessedUnit({
            crewList: [{ unitId: "FIVEKNOB", skillReference: [] }, { unitId: "R2D2", skillReference: [] }],
        });
        const result = unitsToCharacterDB([unit] as any);
        const crew = result[0].updateOne.update.$set.crew as string[];
        assert.deepStrictEqual(crew, ["FIVEKNOB", "R2D2"]);
    });

    it("skips units missing categoryIdList", () => {
        const unit = makeProcessedUnit({ categoryIdList: undefined });
        const result = unitsToCharacterDB([unit] as any);
        assert.strictEqual(result.length, 0);
    });
});

// ---------------------------------------------------------------------------
// unitsForUnitMapFile
// ---------------------------------------------------------------------------

describe("unitsForUnitMapFile", () => {
    it("keys output by baseId", () => {
        const units = [{ baseId: "VADER", nameKey: "UNIT_VADER", combatType: 1, crewList: [] }];
        const result = unitsForUnitMapFile(units as any);
        assert.ok(result["VADER"]);
    });

    it("includes nameKey and combatType", () => {
        const units = [{ baseId: "VADER", nameKey: "UNIT_VADER", combatType: 1, crewList: [] }];
        const result = unitsForUnitMapFile(units as any);
        assert.strictEqual(result["VADER"].nameKey, "UNIT_VADER");
        assert.strictEqual(result["VADER"].combatType, 1);
    });

    it("maps crew from crewList", () => {
        const units = [
            {
                baseId: "HOUNDSTOOTH",
                nameKey: "UNIT_HOUNDSTOOTH",
                combatType: 2,
                crewList: [{ unitId: "BOSSK", skillReference: [], slot: 1 }],
            },
        ];
        const result = unitsForUnitMapFile(units as any);
        assert.strictEqual(result["HOUNDSTOOTH"].crew.length, 1);
        assert.strictEqual(result["HOUNDSTOOTH"].crew[0].unitId, "BOSSK");
    });

    it("returns empty crew array when crewList is empty", () => {
        const units = [{ baseId: "VADER", nameKey: "UNIT_VADER", combatType: 1, crewList: [] }];
        const result = unitsForUnitMapFile(units as any);
        assert.deepStrictEqual(result["VADER"].crew, []);
    });
});
