const config = require("../../config.js");

exports.getGuildShardTimes = async function getTimes({cache, guildId}) {
    const resArr = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {shardtimes: 1});
    return resArr[0]?.shardtimes || [];
};

exports.setGuildShardTimes = async function setTimes({cache, guildId, stOut}) {
    if (!Array.isArray(stOut)) throw new Error("[/shardTimes setTimes] Somehow have a non-array stOut");
    return await cache.put(config.mongodb.swgohbotdb, "guildConfigs", {guildId: guildId}, {shardtimes: stOut}, false);
};
