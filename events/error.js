module.exports = async (Bot, client, error) => {
    Bot.logger.error(`An error event was sent by Discord.js: \n${JSON.stringify(error)}`, "error");
};
