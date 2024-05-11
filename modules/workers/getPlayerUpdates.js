const { workerData, parentPort } = require("node:worker_threads");
// const {langChar} = require("../../modules/swapi.js")(null);

const guildLogOut = [];
const cacheUpdatesOut = [];
const defIdList = new Set();
const skillIdList = new Set();

async function init(workerData) {
    if (!workerData?.updatedBare) return null;
    for (const newPlayer of workerData.updatedBare) {
        const oldPlayer = workerData.oldMembers.find((p) => p.allyCode === newPlayer.allyCode);
        if (!oldPlayer?.roster) {
            // If they've not been in there before, stick em into the db
            cacheUpdatesOut.push({
                updateOne: {
                    filter: { allyCode: newPlayer.allyCode },
                    update: { $set: newPlayer },
                    upsert: true,
                },
            });

            // Then move on, since there's no old data to compare against
            continue;
        }
        if (JSON.stringify(oldPlayer.roster) === JSON.stringify(newPlayer.roster)) continue;

        const playerLog = { abilities: [], geared: [], leveled: [], reliced: [], starred: [], unlocked: [], ultimate: [] };

        // Check through each of the 250ish? units in their roster for differences
        const oldRoster = {};
        for (const oldUnit of oldPlayer.roster) {
            oldRoster[oldUnit.defId] = oldUnit;
        }
        for (const newUnit of newPlayer.roster) {
            // const oldUnit = oldPlayer.roster.find(u => u.defId === newUnit.defId);
            const oldUnit = oldRoster?.[newUnit.defId];
            if (!oldUnit) continue;
            if (JSON.stringify(oldUnit) === JSON.stringify(newUnit)) continue;
            if (!oldUnit) {
                playerLog.unlocked.push(`Unlocked {${newUnit.defId}}!`);
                if (newUnit?.level > 1) {
                    playerLog.unlocked.push(` - Upgraded to level ${newUnit.level}`);
                }
                if (newUnit.gear > 1) {
                    playerLog.unlocked.push(` - Upgraded to gear ${newUnit.gear}`);
                }
                continue;
            }
            if (oldUnit.level < newUnit.level) {
                playerLog.leveled.push(`Leveled up {${newUnit.defId}} to ${newUnit.level}!`);
            }
            if (oldUnit.rarity < newUnit.rarity) {
                playerLog.starred.push(`Starred up {${newUnit.defId}} to ${newUnit.rarity} star!`);
            }
            for (const skillId of newUnit.skills.map((s) => s.id)) {
                // For each of the skills, see if it's changed
                const oldSkill = oldUnit.skills.find((s) => s.id === skillId);
                const newSkill = newUnit.skills.find((s) => s.id === skillId);

                if (newSkill?.tier && ((!oldSkill && newSkill?.tier) || oldSkill?.tier < newSkill?.tier)) {
                    // Grab zeta/ omicron data for the ability if available
                    const thisAbility = workerData.specialAbilities.find((abi) => abi.skillId === newSkill.id);
                    if (thisAbility?.omicronTier) {
                        newSkill.isOmicron = true;
                        newSkill.omicronTier = thisAbility.omicronTier + 1;
                        newSkill.omicronMode = thisAbility.omicronMode;
                    }
                    if (thisAbility?.zetaTier) {
                        newSkill.isZeta = true;
                        newSkill.zetaTier = thisAbility.zetaTier + 1;
                    }

                    // if (!oldSkill) {
                    //     playerLog.abilities.push(`Unlocked ${newUnit.defId}'s **${locSkill.nameKey}**`);
                    // }

                    if (
                        (newSkill.isOmicron || newSkill.isZeta) &&
                        (newSkill.tier >= newSkill.zetaTier || newSkill.tier >= newSkill.omicronTier)
                    ) {
                        // If the skill has zeta/ omicron tiers, and is high enough level
                        if (oldSkill?.tier < newSkill.zetaTier && newSkill.tier >= newSkill.zetaTier) {
                            // If it was below the Zeta tier before, and at or above it now
                            playerLog.abilities.push(`Zeta'd {${newUnit.defId}}'s **{${skillId}}**`);
                        }

                        if (oldSkill?.tier < newSkill.omicronTier && newSkill.tier >= newSkill.omicronTier) {
                            // If it was below the Omicron tier before, and at or above it now
                            playerLog.abilities.push(`Omicron'd {${newUnit.defId}}'s **{${skillId}}**`);
                        }
                    } else {
                        // In case it's either too low to be a zeta or omicron tier upgrade, or just doesn't have one
                        playerLog.abilities.push(`Upgraded {${newUnit.defId}}'s **{${skillId}}** to level ${newSkill.tier}`);
                    }
                }
            }
            if (oldUnit.gear < newUnit.gear) {
                playerLog.geared.push(`Geared up {${newUnit.defId}} to G${newUnit.gear}!`);
            }
            if (oldUnit?.relic?.currentTier < newUnit?.relic?.currentTier && newUnit.relic.currentTier - 2 > 0) {
                playerLog.reliced.push(`Upgraded {${newUnit.defId}} to relic ${newUnit.relic.currentTier - 2}!`);
            }
            if (oldUnit?.purchasedAbilityId?.length < newUnit?.purchasedAbilityId?.length) {
                playerLog.ultimate.push(`Unlocked {${newUnit.defId}}'s **ultimate**'`);
            }
            if (isPlayerUpdated(playerLog)) {
                defIdList.add(newUnit.defId);
                for (const skill of newUnit.skills) {
                    skillIdList.add(skill.id);
                }
            }
        }
        if (isPlayerUpdated(playerLog)) {
            guildLogOut[newPlayer.name] = playerLog;
            cacheUpdatesOut.push({
                updateOne: {
                    filter: { allyCode: newPlayer.allyCode },
                    update: { $set: newPlayer },
                    upsert: true,
                },
            });
        }
    }
}

function isPlayerUpdated(playerLog) {
    for (const key of Object.keys(playerLog).filter((p) => p !== "name")) {
        if (playerLog[key]?.length) return true;
    }
    return false;
}

init(workerData).then(() => {
    parentPort?.postMessage({ guildLogOut, cacheUpdatesOut, defIds: [...defIdList], skills: [...skillIdList] });
});
