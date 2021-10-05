const {inspect} = require("util");
module.exports = async (Bot, client, err) => {
    if (err.error.toString().indexOf("ECONNRESET") > -1) {
        Bot.logger.error("Connection error");
    } else {
        Bot.logger.error("ERROR", inspect(err.error), true);
    }
};
