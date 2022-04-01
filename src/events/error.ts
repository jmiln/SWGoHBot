import { inspect } from "util";
import { Client } from "discord.js";
import { BotType } from "../modules/types";

module.exports = async (Bot: BotType, client: Client, err: Error) => {
    if (err.stack.toString().indexOf("ECONNRESET") > -1) {
        Bot.logger.error("Connection error");
    } else {
        Bot.logger.error("ERROR:\n" + inspect(err.stack), true);
    }
};
