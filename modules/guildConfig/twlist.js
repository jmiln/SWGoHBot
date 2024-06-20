const config = require("../../config.js");
const defaultTWList = {
    characters:   [],
    GLs:          [],
    ships:        [],
    capitalShips: [],
    blacklist: []        // List of units to not show in the list output (Can't have units both here and one of the others)
};

exports.getGuildTWList = async function getGuildTWList({ cache, guildId }) {
    if (!guildId) return defaultTWList;
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { twList: 1 });
    return resArr[0]?.twList || defaultTWList;
};

exports.setGuildTWList = async function setGuildTWList({ cache, guildId, twListOut }) {
    const res = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { twList: twListOut }, false)
        .then(() => { return { success: true, error: null }; })
        .catch((error) => { return { success: false, error: error }; });
    return res;
};
