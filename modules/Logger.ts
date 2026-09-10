import { Writable } from "node:stream";
import { type Embed, EmbedBuilder, WebhookClient } from "discord.js";
import pino, { type Logger as PinoInstance } from "pino";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import { toProperCase } from "./utils/text.ts";

const MAX_THROTTLE_KEYS = 500;

// These live here rather than in modules/functions.ts because this is their only consumer, and
// importing them from there made Logger and functions.ts import each other.
function parseWebhook(url: string): { id: string; token: string } {
    if (!url || typeof url !== "string") {
        throw new Error("Invalid webhook URL: URL must be a non-empty string");
    }

    // Validate Discord webhook URL format
    const webhookPattern = /^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)\/?$/;
    const match = url.match(webhookPattern);

    if (!match) {
        throw new Error(`Invalid webhook URL format: ${url.slice(0, 50)}...`);
    }

    const [, id, token] = match;
    return { id, token };
}

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

export type LogOptions = { webhook?: boolean } & Record<string, unknown>;

// Pino writes these itself. Docker stamps the time and labels the container, so neither the
// timestamp nor a name tag survives into the pretty line.
const PINO_BASE_KEYS = new Set(["level", "time", "pid", "hostname", "name", "msg"]);

function renderFields(obj: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        if (PINO_BASE_KEYS.has(key)) continue;
        parts.push(`${key}=${typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}`);
    }
    return parts.length ? ` ${parts.join(" ")}` : "";
}

export function formatLogLine(raw: string): string {
    try {
        const obj = JSON.parse(raw);
        const level = LEVEL_FORMAT[obj.level] ?? { label: "UNKNOWN", color: ANSI.white };
        return `${level.color}[${level.label}]${ANSI.reset} ${obj.msg ?? ""}${renderFields(obj)}\n`;
    } catch {
        return raw;
    }
}

export function shouldUsePretty(pretty: boolean | undefined, isTTY: boolean): boolean {
    return pretty ?? isTTY;
}

export function splitLogOptions(opts?: boolean | LogOptions): { webhook: boolean; fields: Record<string, unknown> } {
    if (typeof opts === "boolean") return { webhook: opts, fields: {} };
    if (!opts) return { webhook: false, fields: {} };
    const { webhook = false, ...fields } = opts;
    return { webhook, fields };
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

export class Logger {
    private shardId: number;
    private readonly logConfigs: Record<LogType, LogConfig>;
    private pino: PinoInstance;
    private readonly destination?: pino.DestinationStream;
    private readonly throttleMap = new Map<string, { count: number; lastLogged: number }>();

    private logLevel: string = env.LOG_LEVEL === "info" && env.DEBUG_LOGS ? "debug" : env.LOG_LEVEL;

    constructor(shardId = -1, { destination, level }: { destination?: pino.DestinationStream; level?: string } = {}) {
        this.shardId = shardId;
        this.destination = destination;
        if (level) this.logLevel = level;

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

        // Not pino's `base`: that is frozen at construction, so a shard id arriving later would
        // need a rebuild and a second destination on fd 1. Stamped per call instead.
        this.pino = pino(
            {
                level: this.logLevel,
                // pid is always 1 in a container and hostname is the container id, which docker labels already carry.
                base: undefined,
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            this.destination ?? (shouldUsePretty(env.LOG_PRETTY, Boolean(process.stdout.isTTY)) ? prettyStream : pino.destination(1)),
        );
    }

    init(shardId: number): void {
        this.shardId = shardId;
    }

    log(content: unknown, type: LogType = "log", opts?: boolean | LogOptions): void {
        const { pinoLevel, color } = this.logConfigs[type];
        const { webhook, fields } = splitLogOptions(opts);

        // Convert content to string for logging
        const logContent = typeof content === "string" ? content : JSON.stringify(content);
        this.pino[pinoLevel as pino.Level](this.shardId > -1 ? { shardId: this.shardId, ...fields } : fields, logContent);

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

        this.postWebhook(env.DISCORD_WEBHOOK_URL, embed as never);
    }

    /**
     * Post an embed to a Discord webhook. Failures are reported straight to pino rather than through
     * this.log, since this is the webhook path itself and routing its own errors back through it
     * would re-enter sendDiscordWebhook.
     */
    private postWebhook(hookUrl: string, embed: Embed): void {
        try {
            const { id, token } = parseWebhook(hookUrl);
            const hook = new WebhookClient({ id, token });
            hook.send({ embeds: [embed] })
                .catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    this.pino.error(`[postWebhook] Failed to send webhook message: ${message}`);
                    throw err;
                })
                .finally(() => hook.destroy());
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.pino.error(`[postWebhook] ${message}`);
            throw err;
        }
    }

    error(content: unknown, opts?: boolean | LogOptions): void {
        this.log(content, "error", opts);
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
    warn(content: unknown, opts?: boolean | LogOptions): void {
        this.log(content, "warn", opts);
    }
    debug(content: unknown, opts?: boolean | LogOptions): void {
        this.log(content, "debug", opts);
    }
    cmd(content: unknown, opts?: boolean | LogOptions): void {
        this.log(content, "cmd", opts);
    }
    info(content: unknown, opts?: boolean | LogOptions): void {
        this.log(content, "info", opts);
    }
}

const logger = new Logger();
export default logger;
