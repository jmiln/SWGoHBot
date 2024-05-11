const config = require("../../config.js");

exports.getGuildPolls = async function getGuildPolls({ cache, guildId }) {
    if (!guildId) return [];
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: 1 });
    return resArr[0]?.polls || [];
};

exports.setGuildPolls = async function setGuildPolls({ cache, guildId, pollsOut }) {
    // Filter out any settings that are the same as the defaults
    if (!Array.isArray(pollsOut)) throw new Error("[/poll setPolls] Somehow have a non-array pollsOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { polls: pollsOut }, false);
};
