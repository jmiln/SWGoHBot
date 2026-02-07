import { readJSON } from "../../modules/functions.ts";
import type { BotUnit, JourneyName, OmicronCategories, UnitLocation } from "../../types/types.ts";

const __dirname = new URL(".", import.meta.url).pathname;
const dataDir = __dirname + "/../../data";

export const abilityCosts = await readJSON(`${dataDir}/abilityCosts.json`);
export const acronyms: Record<string, string> = await readJSON(`${dataDir}/acronyms.json`);
export const arenaJumps = await readJSON(`${dataDir}/arenaJumps.json`);
export const charLocs: UnitLocation[] = await readJSON(`${dataDir}/charLocations.json`);
export const characters: BotUnit[] = await readJSON(`${dataDir}/characters.json`);
export const journeyReqs = await readJSON(`${dataDir}/journeyReqs.json`);
export const missions = await readJSON(`${dataDir}/missions.json`);
export const omicrons: OmicronCategories = await readJSON(`${dataDir}/omicrons.json`);
export const raidNames = await readJSON(`${dataDir}/raidNames.json`);
export const resources = await readJSON(`${dataDir}/resources.json`);
export const shipLocs: UnitLocation[] = await readJSON(`${dataDir}/shipLocations.json`);
export const ships: BotUnit[] = await readJSON(`${dataDir}/ships.json`);
export const timezones = await readJSON(`${dataDir}/timezones.json`);

export const factions: string[] = [...new Set(characters.reduce((a, b) => a.concat(b.factions), []))];

// Cache the units list to avoid recreating it on every call
export const allUnitsList: BotUnit[] = [...characters, ...ships];

// List of all the unit names to use for autocomplete
export const characterNameList = mapUnitNames(characters, true);
export const shipNameList = mapUnitNames(ships);

// Journey character names for autocomplete (used by /panic command)
export const journeyNames: JourneyName[] = Object.keys(journeyReqs)
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

