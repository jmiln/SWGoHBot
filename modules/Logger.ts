import { EmbedBuilder } from "discord.js";
import pino, { type Logger as PinoInstance } from "pino";
import { env } from "../config/config.ts";
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

    private logLevel = process.env.LOG_LEVEL ?? (env.DEBUG_LOGS ? "debug" : "info");

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
            name: process.env.APP_NAME || "SWGoHBot",
            level: this.logLevel,
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

    log(content: unknown, type: LogType = "log", webhook = false): void {
        const { pinoLevel, color } = this.logConfigs[type];

        // Convert content to string for logging
        const logContent = typeof content === "string" ? content : JSON.stringify(content);
        this.pino[pinoLevel as pino.Level](logContent);

        if (webhook || (type === "error" && typeof content === "string" && content.includes("Unable to authenticate"))) {
            this.sendDiscordWebhook(content, type, color);
        }
    }

    private sendDiscordWebhook(content: unknown, type: LogType, color: number): void {
        if (!env.LOG_TO_CHANNEL || !env.DISCORD_WEBHOOK_URL) return;

        const shardStr = this.shardId > -1 ? ` (${this.shardId})` : "";
        const embed = new EmbedBuilder()
            .setTitle(toProperCase(type) + shardStr)
            .setDescription(typeof content === "string" ? content : `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``)
            .setColor(color)
            .setTimestamp();

        sendWebhook(env.DISCORD_WEBHOOK_URL, embed as never);
    }

    error(content: unknown, webhook = false): void {
        this.log(content, "error", webhook);
    }
    warn(content: unknown, webhook = false): void {
        this.log(content, "warn", webhook);
    }
    debug(content: unknown, webhook = false): void {
        this.log(content, "debug", webhook);
    }
    cmd(content: unknown, webhook = false): void {
        this.log(content, "cmd", webhook);
    }
    info(content: unknown, webhook = false): void {
        this.log(content, "info", webhook);
    }
}

const logger = new Logger();
export default logger;
