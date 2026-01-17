import { readFile } from "fs/promises";
import type { BotUnit,UnitLocation } from "../../types/types.ts";

const jsonFromFile = async (file: string) => await readFile(file, "utf-8").then(JSON.parse);

const __dirname = new URL(".", import.meta.url).pathname;
const dataDir = __dirname + "/../../data";

export const abilityCosts = await jsonFromFile(`${dataDir}/abilityCosts.json`);
export const acronyms = await jsonFromFile(`${dataDir}/acronyms.json`);
export const arenaJumps = await jsonFromFile(`${dataDir}/arenaJumps.json`);
export const charLocs: UnitLocation[] = await jsonFromFile(`${dataDir}/charLocations.json`);
export const characters: BotUnit[] = await jsonFromFile(`${dataDir}/characters.json`);
export const journeyReqs = await jsonFromFile(`${dataDir}/journeyReqs.json`);
export const missions = await jsonFromFile(`${dataDir}/missions.json`);
export const raidNames = await jsonFromFile(`${dataDir}/raidNames.json`);
export const resources = await jsonFromFile(`${dataDir}/resources.json`);
export const shipLocs = await jsonFromFile(`${dataDir}/shipLocations.json`);
export const ships: BotUnit[] = await jsonFromFile(`${dataDir}/ships.json`);
export const timezones = await jsonFromFile(`${dataDir}/timezones.json`);

export const factions: string[] = [...new Set(characters.reduce((a, b) => a.concat(b.factions), []))];

// Cache the units list to avoid recreating it on every call
export const allUnitsList: BotUnit[] = [...characters, ...ships];

// List of all the unit names to use for autocomplete
export const characterNameList = mapUnitNames(characters, true);
export const shipNameList = mapUnitNames(ships);

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

