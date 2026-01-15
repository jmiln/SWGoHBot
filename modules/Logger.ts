import { EmbedBuilder } from "discord.js";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { sendWebhook, toProperCase } from "./functions.ts";

type LogType = "log" | "warn" | "error" | "debug" | "cmd" | "ready" | "info";

interface LogConfig {
    color: number;
    shouldLog: (debugLogsEnabled: boolean) => boolean;
}

class Logger {
    private shardId: number;
    private readonly logConfigs: Record<LogType, LogConfig>;
    private readonly timezone: string;

    constructor(timezone = "America/Los_Angeles", shardId = -1) {
        this.timezone = timezone;
        this.shardId = shardId;

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

    /**
     * Initialize or update the logger's shard ID
     */
    init(shardId: number): void {
        this.shardId = shardId;
    }

    /**
     * Get formatted time string for the configured timezone
     */
    private getFormattedTime(): string {
        return Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZone: this.timezone,
        }).format(new Date());
    }

    // biome-ignore lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    log(content: any, type: LogType = "log", webhook = false): void {
        // Check if this log type should be printed (handles debug logs)
        if (!this.logConfigs[type].shouldLog(!!config.debugLogs)) return;

        const shard = this.shardId > -1 ? ` (${this.shardId})` : "";
        const myTimeStr = this.getFormattedTime();
        const time = myTimeStr.replace(" 0", "  ");
        const timestamp = `[${time
            .split(",")
            .map((t) => t.padStart(9, " "))
            .join(",")}]${shard}`;

        const out = `${timestamp} ${type.toUpperCase()} ${content}`;

        if (webhook) {
            // If it's set to, send it to the webhook too
            if (config.logs.logToChannel && config.webhookURL) {
                const embed = new EmbedBuilder()
                    .setTitle(type ? toProperCase(type) + shard : null)
                    .setDescription(content)
                    .setColor(this.logConfigs[type].color)
                    .setFooter({ text: time });
                sendWebhook(config.webhookURL, embed as never);
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

// Create and export a singleton instance
const logger = new Logger(config.timezone || "America/Los_Angeles");

export default logger;
export { Logger };
