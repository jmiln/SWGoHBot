/*
    Logger class for easy and aesthetically pleasing console logging
    Based off of https://github.com/AnIdiotsGuide/guidebot-class/blob/master/modules/Logger.js
*/
class Logger {
    constructor(Bot, client) {
        this.Bot = Bot;
        this.client = client;
    }
    log(content, type = "log", webhook = false) {
        const shard = this.client?.shard?.id > -1 ? ` (${this.client.shard.id})` : "";
        const time = Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZone: "America/Los_Angeles",
        })
            .format(new Date())
            .replace(" 0", "  ");
        const timestamp = `[${time
            .split(",")
            .map((t) => t.padStart(9, " "))
            .join(",")}]${shard}`;
        let out = "";
        let color = null;
        switch (type) {
            case "log": {
                color = this.Bot.constants.colors.blue;
                out = `${timestamp} ${type.toUpperCase()} ${content} `;
                break;
            }
            case "warn": {
                color = this.Bot.constants.colors.yellow;
                out = `${timestamp} ${type.toUpperCase()} ${content} `;
                break;
            }
            case "error": {
                color = this.Bot.constants.colors.red;
                out = `${timestamp} ${type.toUpperCase()} ${content} `;
                break;
            }
            case "debug": {
                // Only print debug logs if it's set to
                if (!this.Bot.config.debugLogs) return;
                color = this.Bot.constants.colors.green;
                out = `${timestamp} ${type.toUpperCase()} ${content} `;
                break;
            }
            case "cmd": {
                color = this.Bot.constants.colors.white;
                out = `${timestamp} ${type.toUpperCase()} ${content}`;
                break;
            }
            case "ready": {
                color = this.Bot.constants.colors.green;
                out = `${timestamp} ${type.toUpperCase()} ${content}`;
                break;
            }
            default:
                throw new TypeError("Logger type must be either warn, debug, log, ready, cmd or error.");
        }
        if (webhook) {
            // If it's set to, send it to the webhook too
            if (this.Bot.config.logs.logToChannel && this.Bot.config.webhookURL) {
                this.Bot.sendWebhook(this.Bot.config.webhookURL, {
                    title: type ? this.Bot.toProperCase(type) + shard : null,
                    description: content,
                    color: color ? color : null,
                    footer: { text: time },
                });
            }
        }
        return type === "error" ? console.error(out) : console.log(out);
    }

    error(content, webhook = false) {
        if (typeof content === "string" && content?.includes("Unable to authenticate")) {
            return this.log(content, "error", true);
        }
        return this.log(content, "error", webhook);
    }

    warn(content, webhook = false) {
        return this.log(content, "warn", webhook);
    }

    debug(content, webhook = false) {
        return this.log(content, "debug", webhook);
    }

    cmd(content, webhook = false) {
        return this.log(content, "cmd", webhook);
    }
}

module.exports = Logger;
