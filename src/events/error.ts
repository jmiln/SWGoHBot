import { inspect } from "util";
import { Client } from "discord.js";

module.exports = async (Bot: {}, client: Client, err: Error) => {
    if (err.error.toString().indexOf("ECONNRESET") > -1) {
        Bot.logger.error("Connection error");
    } else {
        Bot.logger.error("ERROR", inspect(err.error), true);
    }
};
