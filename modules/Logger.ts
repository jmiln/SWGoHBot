import { Writable } from "node:stream";
import { EmbedBuilder } from "discord.js";
import pino, { type Logger as PinoInstance } from "pino";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { myTime, sendWebhook, toProperCase } from "./functions.ts";

const MAX_THROTTLE_KEYS = 500;

type LogType = "log" | "warn" | "error" | "debug" | "cmd" | "ready" | "info";

interface LogConfig {
    color: number;
    pinoLevel: string;
}

// ANSI color codes for log level coloring
const ANSI = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
} as const;

// Map pino numeric levels to display names and colors
const LEVEL_FORMAT: Record<number, { label: string; color: string }> = {
    10: { label: "TRACE", color: ANSI.white },
    20: { label: "DEBUG", color: ANSI.cyan },
    30: { label: "INFO", color: ANSI.green },
    40: { label: "WARN", color: ANSI.yellow },
    50: { label: "ERROR", color: ANSI.red },
    60: { label: "FATAL", color: ANSI.red },
};

function formatLogLine(raw: string): string {
    try {
        const obj = JSON.parse(raw);
        const appName = obj.name ?? "SWGoHBot";
        const level = LEVEL_FORMAT[obj.level] ?? { label: "UNKNOWN", color: ANSI.white };
        const msg = obj.msg ?? "";
        return `[${appName}] ${level.color}[${level.label}]${ANSI.reset} [${myTime()}] ${msg}\n`;
    } catch {
        return raw;
    }
}

const prettyStream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
            process.stdout.write(formatLogLine(line));
        }
        callback();
    },
});

class Logger {
    private shardId: number;
    private readonly logConfigs: Record<LogType, LogConfig>;
    private pino: PinoInstance;
    private readonly throttleMap = new Map<string, { count: number; lastLogged: number }>();

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

        this.pino = pino(
            {
                name: process.env.APP_NAME || "SWGoHBot",
                level: this.logLevel,
                base: { shardId: this.shardId > -1 ? this.shardId : undefined },
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            prettyStream,
        );
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

    /**
     * Log an error with rate-limiting by key. The first occurrence in each window is logged
     * immediately. Subsequent occurrences within windowMs are suppressed and counted. When
     * the next error arrives after the window expires, the suppressed count is reported first.
     */
    throttleError(key: string, content: string, windowMs = 60_000): void {
        const now = Date.now();

        if (!this.throttleMap.has(key) && this.throttleMap.size >= MAX_THROTTLE_KEYS) {
            for (const [k, v] of this.throttleMap) {
                if (now - v.lastLogged >= windowMs) {
                    this.throttleMap.delete(k);
                }
            }
        }

        const entry = this.throttleMap.get(key);

        if (!entry || now - entry.lastLogged >= windowMs) {
            if (entry && entry.count > 0) {
                this.error(`[${key}] ${entry.count} additional error(s) suppressed in the last ${Math.round(windowMs / 1000)}s`);
            }
            this.error(content);
            this.throttleMap.set(key, { count: 0, lastLogged: now });
        } else {
            entry.count++;
        }
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
