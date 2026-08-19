import { readJSON } from "../../modules/functions.ts";
import type { SWAPILang } from "../../types/swapi_types.ts";
import type { BotUnit, JourneyName, JourneyReqs, OmicronCategories, RefreshCount, UnitLocation } from "../../types/types.ts";

const __dirname = new URL(".", import.meta.url).pathname;
const dataDir = __dirname + "/../../data";

export const acronyms: Record<string, string> = await readJSON(`${dataDir}/acronyms.json`);
export const arenaJumps: Record<string, number> = await readJSON(`${dataDir}/arenaJumps.json`);
export const charLocs: UnitLocation[] = await readJSON(`${dataDir}/charLocations.json`);
// These values are refreshed in place by refreshUnitData(), so the arrays and objects themselves
// are stable for the life of the process while their contents change. Two rules follow:
// never reassign one of these bindings, and never copy one at module scope - a module-level
// `[...characters]` becomes a snapshot that silently stops updating. Reading them inside a
// function, which is what every consumer does today, is always correct.
export const characters: BotUnit[] = await readJSON(`${dataDir}/characters.json`);
export const journeyReqs: JourneyReqs = await readJSON(`${dataDir}/journeyReqs.json`);
export const omicrons: OmicronCategories = await readJSON(`${dataDir}/omicrons.json`);
export const raidNames: Record<string, Record<string, string>> = await readJSON(`${dataDir}/raidNames.json`);
export const shipLocs: UnitLocation[] = await readJSON(`${dataDir}/shipLocations.json`);
export const ships: BotUnit[] = await readJSON(`${dataDir}/ships.json`);

// New build artifact from dataUpdater; may be absent before the first run, so default to an
// empty map rather than crashing boot. resolveUnitName falls back to the defId in that case.
export const unitNames: Record<string, Record<string, string>> = await readJSON<Record<string, Record<string, string>>>(
    `${dataDir}/unitNames.json`,
).catch((): Record<string, Record<string, string>> => ({}));

/**
 * Resolve a defId to a localized display name from a given map.
 * Fallback chain: requested lang -> eng_us -> the raw defId, so it never returns undefined.
 */
export function resolveUnitName(map: Record<string, Record<string, string>>, defId: string, lang: SWAPILang = "eng_us"): string {
    const byLang = map[defId];
    if (!byLang) return defId;
    return byLang[lang.toLowerCase()] ?? byLang.eng_us ?? defId;
}

/** defId -> localized display name using the boot-loaded unitNames map. */
export function unitNameOf(defId: string, lang: SWAPILang = "eng_us"): string {
    return resolveUnitName(unitNames, defId, lang);
}

function buildFactions(): string[] {
    return [...new Set(characters.reduce<string[]>((a, b) => a.concat(b.factions), []))];
}

export const factions: string[] = buildFactions();

// Cache the units list to avoid recreating it on every call
export const allUnitsList: BotUnit[] = [...characters, ...ships];

// List of all the unit names to use for autocomplete
export const characterNameList = mapUnitNames(characters, true);
export const shipNameList = mapUnitNames(ships);

// Journey character names for autocomplete (used by /panic command)
function buildJourneyNames(): JourneyName[] {
    return Object.keys(journeyReqs)
        .map((key) => {
            let unit = characters.find((ch) => ch.uniqueName === key);
            if (!unit) {
                unit = ships.find((sh) => sh.uniqueName === key);
            }
            if (!unit) return null;
            return {
                defId: key,
                name: unit.name,
                aliases: unit?.aliases?.map((u) => u.toLowerCase()) || [],
            };
        })
        .filter((item): item is JourneyName => item !== null);
}

export const journeyNames: JourneyName[] = buildJourneyNames();

function mapUnitNames(units: BotUnit[], addGLSuffix = false) {
    return units.map((unit) => {
        let suffix = "";
        if (addGLSuffix && unit.factions?.includes("Galactic Legend")) {
            suffix = "(GL)";
        }
        return {
            name: `${unit.name} ${suffix}`.trim(),
            defId: unit.uniqueName,
            aliases: unit.aliases || [],
        };
    });
}


// The eight files dataUpdater rewrites. The other two loaded above (acronyms, arenaJumps) are
// hand-maintained, so nothing watches or reloads them.
export const UNIT_DATA_FILES: string[] = [
    `${dataDir}/characters.json`,
    `${dataDir}/ships.json`,
    `${dataDir}/charLocations.json`,
    `${dataDir}/shipLocations.json`,
    `${dataDir}/journeyReqs.json`,
    `${dataDir}/omicrons.json`,
    `${dataDir}/raidNames.json`,
    `${dataDir}/unitNames.json`,
];

/** Swap an array's contents without replacing the array object importers hold. */
function replaceArray<T>(target: T[], fresh: T[]): number {
    target.splice(0, target.length, ...fresh);
    return target.length;
}

/** Swap a record's contents in place. Stale keys are deleted rather than merged over. */
function replaceRecord<T extends object>(target: T, fresh: T): number {
    for (const key of Object.keys(target)) {
        // Keys come from Object.keys(target), so this index is safe; the cast only satisfies the
        // compiler, which cannot know that for a generic object type.
        delete (target as Record<string, unknown>)[key];
    }
    Object.assign(target, fresh);
    return Object.keys(target).length;
}

/**
 * Merge fresh units into the existing array by uniqueName, updating matched units in place. This
 * preserves object identity, so any code holding a reference to a single unit keeps seeing live
 * data. Wholesale replacement would work today but would silently break the first consumer that
 * retains a unit.
 */
function mergeUnits(target: BotUnit[], fresh: BotUnit[]): { added: number; removed: number; updated: number } {
    const existingByName = new Map(target.map((unit) => [unit.uniqueName, unit]));
    const freshNames = new Set(fresh.map((unit) => unit.uniqueName));
    let added = 0;
    let removed = 0;
    let updated = 0;

    for (const freshUnit of fresh) {
        const existing = existingByName.get(freshUnit.uniqueName);
        if (!existing) {
            target.push(freshUnit);
            added++;
            continue;
        }
        // Both sides are produced by the same dataUpdater serializer, so key order is stable and a
        // string compare is a valid cheap equality check.
        if (JSON.stringify(existing) === JSON.stringify(freshUnit)) continue;
        for (const key of Object.keys(existing)) {
            delete (existing as unknown as Record<string, unknown>)[key];
        }
        Object.assign(existing, freshUnit);
        updated++;
    }

    for (let i = target.length - 1; i >= 0; i--) {
        if (freshNames.has(target[i].uniqueName)) continue;
        target.splice(i, 1);
        removed++;
    }

    return { added, removed, updated };
}

/** Rebuild every value derived from characters/ships/journeyReqs, in place. */
function rebuildDerived(): void {
    replaceArray(factions, buildFactions());
    // allUnitsList is a shallow copy, so merging units does not reach it when any were added or
    // removed. It has to be rebuilt explicitly.
    replaceArray(allUnitsList, [...characters, ...ships]);
    replaceArray(characterNameList, mapUnitNames(characters, true));
    replaceArray(shipNameList, mapUnitNames(ships));
    replaceArray(journeyNames, buildJourneyNames());
}

/**
 * Re-read the eight live data files and apply them to the exported bindings.
 *
 * Reads and parses everything first: if any file fails, this throws and no state has been touched.
 * The apply phase below runs synchronously with no await, so no command handler can observe a
 * half-updated state.
 *
 * `dir` is injectable for tests only; production always uses the module's own data directory.
 */
export async function refreshUnitData(dir: string = dataDir): Promise<RefreshCount[]> {
    const [freshChars, freshShips, freshCharLocs, freshShipLocs, freshJourneyReqs, freshOmicrons, freshRaidNames, freshUnitNames] =
        await Promise.all([
            readJSON<BotUnit[]>(`${dir}/characters.json`),
            readJSON<BotUnit[]>(`${dir}/ships.json`),
            readJSON<UnitLocation[]>(`${dir}/charLocations.json`),
            readJSON<UnitLocation[]>(`${dir}/shipLocations.json`),
            readJSON<JourneyReqs>(`${dir}/journeyReqs.json`),
            readJSON<OmicronCategories>(`${dir}/omicrons.json`),
            readJSON<Record<string, Record<string, string>>>(`${dir}/raidNames.json`),
            // Same fallback as the boot-time load: absent before dataUpdater's first run.
            readJSON<Record<string, Record<string, string>>>(`${dir}/unitNames.json`).catch(
                (): Record<string, Record<string, string>> => ({}),
            ),
        ]);

    // --- apply phase: synchronous, no await below this line ---
    const charCounts = mergeUnits(characters, freshChars);
    const shipCounts = mergeUnits(ships, freshShips);
    const charLocTotal = replaceArray(charLocs, freshCharLocs);
    const shipLocTotal = replaceArray(shipLocs, freshShipLocs);
    const journeyTotal = replaceRecord(journeyReqs, freshJourneyReqs);
    const omicronTotal = replaceRecord(omicrons, freshOmicrons);
    const raidTotal = replaceRecord(raidNames, freshRaidNames);
    const unitNameTotal = replaceRecord(unitNames, freshUnitNames);
    rebuildDerived();

    return [
        { label: "characters", total: characters.length, ...charCounts },
        { label: "ships", total: ships.length, ...shipCounts },
        { label: "charLocations", total: charLocTotal, noun: "entries" },
        { label: "shipLocations", total: shipLocTotal, noun: "entries" },
        { label: "journeyReqs", total: journeyTotal, noun: "keys" },
        { label: "omicrons", total: omicronTotal, noun: "keys" },
        { label: "raidNames", total: raidTotal, noun: "keys" },
        { label: "unitNames", total: unitNameTotal, noun: "keys" },
    ];
}
