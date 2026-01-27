import { EmbedBuilder } from "discord.js";
import pino, { type Logger as PinoInstance } from "pino";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { sendWebhook, toProperCase } from "./functions.ts";

type LogType = "log" | "warn" | "error" | "debug" | "cmd" | "ready" | "info";

interface LogConfig {
    color: number;
    pinoLevel: string;
}

class Logger {
    private shardId: number;
    private readonly logConfigs: Record<LogType, LogConfig>;
    private pino: PinoInstance;

    constructor(shardId = -1) {
        this.shardId = shardId;

        // Map your custom types to Pino levels and Discord colors
        this.logConfigs = {
            cmd: { color: constants.colors.white, pinoLevel: "info" },
            debug: { color: constants.colors.green, pinoLevel: "debug" },
            error: { color: constants.colors.red, pinoLevel: "error" },
            info: { color: constants.colors.blue, pinoLevel: "info" },
            log: { color: constants.colors.blue, pinoLevel: "info" },
            ready: { color: constants.colors.green, pinoLevel: "info" },
            warn: { color: constants.colors.yellow, pinoLevel: "warn" },
        };

        this.pino = pino({
            level: config.debugLogs ? "debug" : "info",
            base: { shardId: this.shardId > -1 ? this.shardId : undefined },
            timestamp: pino.stdTimeFunctions.isoTime,
        });
    }

    /**
     * Update shard ID and recreate the pino child instance with the new context
     */
    init(shardId: number): void {
        this.shardId = shardId;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Let it log anything
    log(content: any, type: LogType = "log", webhook = false): void {
        const { pinoLevel, color } = this.logConfigs[type];

        this.pino[pinoLevel as pino.Level](content);

        if (webhook || (type === "error" && typeof content === "string" && content.includes("Unable to authenticate"))) {
            this.sendDiscordWebhook(content, type, color);
        }
    }

    // biome-ignore lint/suspicious/noExplicitAny: Let it log anything
    private sendDiscordWebhook(content: any, type: LogType, color: number): void {
        if (!config.logs.logToChannel || !config.webhookURL) return;

        const shardStr = this.shardId > -1 ? ` (${this.shardId})` : "";
        const embed = new EmbedBuilder()
            .setTitle(toProperCase(type) + shardStr)
            .setDescription(typeof content === "string" ? content : `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``)
            .setColor(color)
            .setTimestamp();

        sendWebhook(config.webhookURL, embed as never);
    }

    // biome-ignore-start lint/suspicious/noExplicitAny: It should be able to log anything I need it to
    error(content: any, webhook = false): void {
        this.log(content, "error", webhook);
    }
    warn(content: any, webhook = false): void {
        this.log(content, "warn", webhook);
    }
    debug(content: any, webhook = false): void {
        this.log(content, "debug", webhook);
    }
    cmd(content: any, webhook = false): void {
        this.log(content, "cmd", webhook);
    }
    info(content: any, webhook = false): void {
        this.log(content, "info", webhook);
    }
    // biome-ignore-end lint/suspicious/noExplicitAny: It should be able to log anything I need it to
}

const logger = new Logger();
export default logger;
