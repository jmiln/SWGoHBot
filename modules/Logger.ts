import config from "../config.ts";
import constants from "../data/constants/constants.ts";
import type { BotType } from "../types/types.ts";
import { sendWebhook, toProperCase } from "./functions.ts";

type LogType = "log" | "warn" | "error" | "debug" | "cmd" | "ready" | "info";

interface LogConfig {
    color: number;
    shouldLog: (debugLogsEnabled: boolean) => boolean;
}

class Logger {
    Bot: BotType;

    private readonly logConfigs: Record<LogType, LogConfig>;
    private readonly timezone: string;

    constructor(Bot: BotType, timezone = "America/Los_Angeles") {
        this.Bot = Bot;
        this.timezone = timezone;

        // Configuration for each log type
        this.logConfigs = {
            log: {
                color: constants.colors.blue,
                shouldLog: () => true,
            },
            info: {
                color: constants.colors.blue,
                shouldLog: () => true,
            },
            warn: {
                color: constants.colors.yellow,
                shouldLog: () => true,
            },
            error: {
                color: constants.colors.red,
                shouldLog: () => true,
            },
            debug: {
                color: constants.colors.green,
                shouldLog: (debugLogsEnabled) => debugLogsEnabled,
            },
            cmd: {
                color: constants.colors.white,
                shouldLog: () => true,
            },
            ready: {
                color: constants.colors.green,
                shouldLog: () => true,
            },
        };
    }
    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    log(content: any, type: LogType = "log", webhook = false): void {
        // Check if this log type should be printed (handles debug logs)
        if (!this.logConfigs[type].shouldLog(!!config.debugLogs)) return;

        const shard = this.Bot?.shardId > -1 ? ` (${this.Bot.shardId})` : "";
        const formatter = new Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZone: this.timezone,
        });
        const time = formatter.format(new Date()).replace(" 0", "  ");
        const timestamp = `[${time
            .split(",")
            .map((t) => t.padStart(9, " "))
            .join(",")}]${shard}`;

        const out = `${timestamp} ${type.toUpperCase()} ${content}`;

        if (webhook) {
            // If it's set to, send it to the webhook too
            if (config.logs.logToChannel && config.webhookURL) {
                sendWebhook(config.webhookURL, {
                    title: type ? toProperCase(type) + shard : null,
                    description: content,
                    color: this.logConfigs[type].color,
                    footer: { text: time },
                });
            }
        }

        type === "error" ? console.error(out) : console.log(out);
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    error(content: any, webhook = false): void {
        // Special case: Authentication errors are always sent to webhook for monitoring
        if (typeof content === "string" && content?.includes("Unable to authenticate")) {
            this.log(content, "error", true);
            return;
        }
        this.log(content, "error", webhook);
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    warn(content: any, webhook = false): void {
        this.log(content, "warn", webhook);
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    debug(content: any, webhook = false): void {
        this.log(content, "debug", webhook);
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    cmd(content: any, webhook = false): void {
        this.log(content, "cmd", webhook);
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    info(content: any, webhook = false): void {
        this.log(content, "info", webhook);
    }
}
export default Logger;
