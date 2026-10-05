import { parentPort, workerData } from "node:worker_threads";

import type { RawPlayer, RawPlayerUnit } from "../../schemas/players.schema.ts";
import type { SWAPIUnitAbility, SWAPIWorkerGuildLog, SWAPIWorkerPlayerLog } from "../../types/swapi_types.ts";

type TrackedPlayer = Omit<RawPlayer, "updated">;
const guildLogOut: SWAPIWorkerGuildLog = {};
type RawPlayerWrite =
    | { updateOne: { filter: { allyCode: number }; update: { $set: Partial<RawPlayer> } } }
    | { replaceOne: { filter: { allyCode: number }; replacement: RawPlayer; upsert: true } };
const cacheUpdatesOut: RawPlayerWrite[] = [];

// `updated` means "last fetched", not "last changed": databaseCleanup ages rawPlayers out on it, and
// a tracked player whose roster sits still must keep the baseline their next change is diffed against
const fetchedAt = Date.now();
const saveBaseline = (player: TrackedPlayer): RawPlayerWrite => ({
    replaceOne: { filter: { allyCode: player.allyCode }, replacement: { ...player, updated: fetchedAt }, upsert: true },
});
const stampFetched = (player: TrackedPlayer): RawPlayerWrite => ({
    updateOne: { filter: { allyCode: player.allyCode }, update: { $set: { updated: fetchedAt } } },
});
const defIdList = new Set<string>();
const skillIdList = new Set<string>();

// WorkerData: { oldMembers, updatedBare, specialAbilities, chunkIx }
async function init(workerData: {
    oldMembers: TrackedPlayer[];
    updatedBare: TrackedPlayer[];
    specialAbilities: Map<string, SWAPIUnitAbility>;
    chunkIx: number;
}): Promise<void> {
    if (!workerData?.updatedBare) return;
    const oldPlayersByAllyCode = new Map(workerData.oldMembers.map((player) => [player.allyCode, player]));
    for (const newPlayer of workerData.updatedBare) {
        const oldPlayer = oldPlayersByAllyCode.get(newPlayer.allyCode);
        if (!oldPlayer?.roster) {
            // If they've not been in there before, stick em into the db
            cacheUpdatesOut.push(saveBaseline(newPlayer));

            // Then move on, since there's no old data to compare against
            continue;
        }

        const playerLog: SWAPIWorkerPlayerLog = {
            abilities: [],
            geared: [],
            leveled: [],
            reliced: [],
            starred: [],
            unlocked: [],
            ultimate: [],
        };

        // Check through each of the 250ish? units in their roster for differences
        const oldRoster = new Map(oldPlayer.roster.map((unit) => [unit.defId, unit]));
        for (const newUnit of newPlayer.roster) {
            const oldUnit = oldRoster.get(newUnit.defId);
            let unitLogged = false;
            const log = (entries: string[], entry: string) => {
                entries.push(entry);
                unitLogged = true;
            };

            if (!oldUnit) {
                log(playerLog.unlocked, `Unlocked {${newUnit.defId}}!`);
                if (newUnit?.level > 1) {
                    log(playerLog.unlocked, ` - Upgraded to level ${newUnit.level}`);
                }
                if (newUnit.gear > 1) {
                    log(playerLog.unlocked, ` - Upgraded to gear ${newUnit.gear}`);
                }
            } else {
                logUnitChanges(oldUnit, newUnit, playerLog, log, workerData.specialAbilities);
            }

            if (unitLogged) {
                defIdList.add(newUnit.defId);
                for (const skill of newUnit.skills) {
                    skillIdList.add(skill.id);
                }
            }
        }
        if (isPlayerUpdated(playerLog)) {
            guildLogOut[newPlayer.name] = playerLog;
            cacheUpdatesOut.push(saveBaseline(newPlayer));
        } else {
            cacheUpdatesOut.push(stampFetched(newPlayer));
        }
    }
}

function logUnitChanges(
    oldUnit: RawPlayerUnit,
    newUnit: RawPlayerUnit,
    playerLog: SWAPIWorkerPlayerLog,
    log: (entries: string[], entry: string) => void,
    specialAbilities: Map<string, SWAPIUnitAbility>,
): void {
    if (oldUnit.level < newUnit.level) {
        log(playerLog.leveled, `Leveled up {${newUnit.defId}} to ${newUnit.level}!`);
    }
    if (oldUnit.rarity < newUnit.rarity) {
        log(playerLog.starred, `Starred up {${newUnit.defId}} to ${newUnit.rarity} star!`);
    }
    for (const newSkill of newUnit.skills) {
        // For each of the skills, see if it's changed
        const skillId = newSkill.id;
        const oldSkill = oldUnit.skills.find((s) => s.id === skillId);

        if (newSkill.tier && (!oldSkill || oldSkill.tier < newSkill.tier)) {
            // Grab zeta/ omicron data for the ability if available
            const thisAbility = specialAbilities.get(skillId);

            // if (!oldSkill) {
            //     playerLog.abilities.push(`Unlocked ${newUnit.defId}'s **${locSkill.nameKey}**`);
            // }

            // zeta/omicron tiers only exist on processed skills; default missing tiers so the
            // threshold comparisons evaluate false (matching the prior undefined-comparison behaviour)
            const oldTier = oldSkill?.tier ?? Number.POSITIVE_INFINITY;
            const zetaTier = thisAbility?.zetaTier ? thisAbility.zetaTier + 1 : Number.POSITIVE_INFINITY;
            const omicronTier = thisAbility?.omicronTier ? thisAbility.omicronTier + 1 : Number.POSITIVE_INFINITY;
            const hasSpecialTier = zetaTier !== Number.POSITIVE_INFINITY || omicronTier !== Number.POSITIVE_INFINITY;

            if (hasSpecialTier && (newSkill.tier >= zetaTier || newSkill.tier >= omicronTier)) {
                // If the skill has zeta/ omicron tiers, and is high enough level
                if (oldTier < zetaTier && newSkill.tier >= zetaTier) {
                    // If it was below the Zeta tier before, and at or above it now
                    log(playerLog.abilities, `Zeta'd {${newUnit.defId}}'s **{${skillId}}**`);
                }

                if (oldTier < omicronTier && newSkill.tier >= omicronTier) {
                    // If it was below the Omicron tier before, and at or above it now
                    log(playerLog.abilities, `Omicron'd {${newUnit.defId}}'s **{${skillId}}**`);
                }
            } else {
                // In case it's either too low to be a zeta or omicron tier upgrade, or just doesn't have one
                log(playerLog.abilities, `Upgraded {${newUnit.defId}}'s **{${skillId}}** to level ${newSkill.tier}`);
            }
        }
    }
    if (oldUnit.gear < newUnit.gear) {
        log(playerLog.geared, `Geared up {${newUnit.defId}} to G${newUnit.gear}!`);
    }
    if (
        newUnit.relic &&
        (oldUnit.relic?.currentTier ?? Number.POSITIVE_INFINITY) < newUnit.relic.currentTier &&
        newUnit.relic.currentTier - 2 > 0
    ) {
        log(playerLog.reliced, `Upgraded {${newUnit.defId}} to relic ${newUnit.relic.currentTier - 2}!`);
    }
    if (oldUnit?.purchasedAbilityId?.length < newUnit?.purchasedAbilityId?.length) {
        log(playerLog.ultimate, `Unlocked {${newUnit.defId}}'s **ultimate**`);
    }
}

function isPlayerUpdated(playerLog: SWAPIWorkerPlayerLog) {
    for (const key of Object.keys(playerLog).filter((p) => p !== "name")) {
        if (playerLog[key]?.length) return true;
    }
    return false;
}

init(workerData)
    .then(() => {
        parentPort?.postMessage({ guildLogOut, cacheUpdatesOut, defIds: [...defIdList], skills: [...skillIdList] });
    })
    .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[getPlayerUpdates worker] Unhandled error: ${message}`);
        process.exit(1);
    });
