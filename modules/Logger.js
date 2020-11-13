/*
    Logger class for easy and aesthetically pleasing console logging
    Based off of https://github.com/AnIdiotsGuide/guidebot-class/blob/master/modules/Logger.js
*/
const chalk = require("chalk");
const moment = require("moment-timezone");

class Logger {
    constructor(Bot, client) {
        this.Bot = Bot;
        this.client = client;
    }
    log(content, type = "log", webhook = false) {
        const shard = this.client.shard ? ` (${this.client.shard.id})` : "";
        const time = `${moment.tz("US/Pacific").format("M/D/YYYY hh:mma").replace(" 0", "  ")}`;
        const timestamp = `[${time}]${shard}`;
        let out = "";
        let color = null;
        switch (type) {
            case "log": {
                color = this.Bot.colors.blue;
                out = `${timestamp} ${chalk.white.bgBlue(type.toUpperCase())} ${content} `;
                break;
            }
            case "warn": {
                color = this.Bot.colors.yellow;
                out =`${timestamp} ${chalk.black.bgYellow(type.toUpperCase())} ${content} `;
                break;
            }
            case "error": {
                color = this.Bot.colors.red;
                out =`${timestamp} ${chalk.black.bgRed(type.toUpperCase())} ${content} `;
                break;
            }
            case "debug": {
                // Only print debug logs if it's set to
                if (!this.Bot.config.debugLogs) return;
                color = this.Bot.colors.green;
                out =`${timestamp} ${chalk.green(type.toUpperCase())} ${content} `;
                break;
            }
            case "cmd": {
                color = this.Bot.colors.white;
                out =`${timestamp} ${chalk.black.bgWhite(type.toUpperCase())} ${content}`;
                break;
            }
            case "ready": {
                color = this.Bot.colors.green;
                out =`${timestamp} ${chalk.black.bgGreen(type.toUpperCase())} ${content}`;
                break;
            }
            default: throw new TypeError("Logger type must be either warn, debug, log, ready, cmd or error.");
        }
        if (webhook) {
            // If it's set to, send it to the webhook too
            if (this.Bot.config.logs.logToChannel && this.Bot.config.webhookURL) {
                this.Bot.sendWebhook(this.Bot.config.webhookURL, {
                    title: type ? type.toProperCase() + shard : null,
                    description: content,
                    color: color ? color : null,
                    footer: {text: time}
                });
            }
        }
        return type === "error" ? console.error(out) : console.log(out);
    }

    error(content, webhook=false) {
        if (content.includes("Unable to authenticate")) webhook = true;
        return this.log(content, "error", webhook);
    }

    warn(content, webhook=false) {
        return this.log(content, "warn", webhook);
    }

    debug(content, webhook=false) {
        return this.log(content, "debug", webhook);
    }

    cmd(content, webhook=false) {
        return this.log(content, "cmd", webhook);
    }
}

module.exports = Logger;
