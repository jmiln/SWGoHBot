const config = require("../../config.js");

exports.getGuildAliases = async function getGuildAliases({ cache, guildId }) {
    if (!guildId) return [];
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { aliases: 1 });
    return resArr[0]?.aliases || [];
};

exports.setGuildAliases = async function setGuildAliases({ cache, guildId, aliasesOut }) {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(aliasesOut)) throw new Error("[guildConfigs/aliases] Somehow have a non-array aliasesOut");
    aliasesOut = aliasesOut.sort((a, b) => (a.alias > b.alias ? 1 : -1));
    const res = await cache
        .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId }, { aliases: aliasesOut }, false)
        .then(() => {
            return { success: true, error: null };
        })
        .catch((error) => {
            return { success: false, error: error };
        });
    return res;
};
