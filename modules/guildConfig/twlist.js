const config = require("../../config.js");
const unitChecklist = require("../../data/unitChecklist.js");
const defaultTWList = {
    "Light Side":       [],
    "Dark Side":        [],
    "Galactic Legends": [],
    Ships:              [],
    "Capital Ships":    [],
    Blacklist: []        // List of units to not show in the list output (Can't have units both here and one of the others)
};

exports.getGuildTWList = async function getGuildTWList({ cache, guildId }) {
    if (!guildId) return defaultTWList;
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { twList: 1 });
    const outObj = {};
    for (const key of Object.keys(defaultTWList)) {
        outObj[key] = resArr[0]?.twList?.[key] || [];
    }
    return outObj || defaultTWList;
};

exports.getFullTWList = async function getFullTWList({ cache, guildId }) {
    if (!guildId) return unitChecklist;
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { twList: 1 });
    const twList = resArr[0]?.twList || defaultTWList;

    const twListOut = {};
    for (const unitType of Object.keys(unitChecklist)) {
        if (!twListOut[unitType]) twListOut[unitType] = {};
        for (const defId of twList[unitType]) {
            if (twList.Blacklist.includes(defId)) continue;
            if (!twListOut[unitType][defId]) twListOut[unitType][defId] = "";
        }
        for (const [defId, shortName] of unitChecklist[unitType]) {
            if (twList.Blacklist.includes(defId)) continue;
            if (!twListOut[unitType][defId]) twListOut[unitType][defId] = shortName;
        }
    }
    return twListOut;
};

exports.setGuildTWList = async function setGuildTWList({ cache, guildId, twListOut }) {
    const res = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { twList: twListOut }, false)
        .then(() => { return { success: true, error: null }; })
        .catch((error) => { return { success: false, error: error }; });
    return res;
};
