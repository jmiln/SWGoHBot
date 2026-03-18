import { env } from "../config/config.ts";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";
import logger from "./Logger.ts";

const ERROR_THROTTLE_MS = 60000;
const DEFAULT_TIMEOUT = 5000;

/**
 * Singleton socket.io client for cross-shard event communication.
 * Manages connection lifecycle and provides high-level API for event operations.
 */
class EventSocket {
    private static instance: EventSocket;
    private shardId: number | null = null;
    private lastErrorTime = 0;
    private errorCount = 0;

    private constructor() {
        // Private constructor prevents direct instantiation
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): EventSocket {
        if (!EventSocket.instance) {
            EventSocket.instance = new EventSocket();
        }
        return EventSocket.instance;
    }

    /**
     * Initialize the socket connection for this shard
     */
    /** No-op: HTTP is stateless. Kept for API compatibility. */
    connect(shardId: number): void {
        this.shardId = shardId;
        logger.log(`  [${this.shardId}] EventSocket ready (HTTP mode)`);
    }

    /**
     * Disconnect and cleanup the socket
     */
    /** No-op: HTTP is stateless. Kept for API compatibility. */
    disconnect(): void {
        logger.log(`  [${this.shardId}] EventSocket disconnected (HTTP mode)`);
    }

    /**
     * Check if socket is connected
     */
    /** Always true: HTTP is stateless. Kept for API compatibility. */
    isConnected(): boolean {
        return true;
    }

    /**
     * POST to the event server with a JSON body and return the parsed response.
     */
    private async post<T>(endpoint: string, body?: unknown): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (env.EVENT_SERVER_SECRET) {
            headers["Authorization"] = `Bearer ${env.EVENT_SERVER_SECRET}`;
        }

        try {
            const response = await fetch(`${env.EVENT_SERVER_URL}${endpoint}`, {
                method: "POST",
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from ${endpoint}`);
            }

            return response.json() as Promise<T>;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Check for events that need to be triggered
     */
    async checkEvents(): Promise<GuildConfigEvent[]> {
        try {
            const events = await this.post<GuildConfigEvent[]>("/checkEvents");
            return Array.isArray(events) ? events : [];
        } catch (error) {
            this.logThrottledError("checkEvents failed", error instanceof Error ? error : undefined);
            return [];
        }
    }

    /**
     * Add one or more events to a guild
     */
    async addEvents(
        guildId: string,
        events: GuildConfigEvent | GuildConfigEvent[],
    ): Promise<{ success: boolean; error: string; event: GuildConfigEvent }[]> {
        try {
            return await this.post("/addEvents", {
                guildId,
                events,
            });
        } catch (error) {
            const eventArr = Array.isArray(events) ? events : [events];
            return eventArr.map((event) => ({
                success: false,
                error: `EventMgr unavailable: ${error instanceof Error ? error.message : "Connection failed"}`,
                event,
            }));
        }
    }

    /**
     * Delete an event from a guild
     */
    async deleteEvent(guildId: string, eventName: string): Promise<{ success: boolean; error?: string; eventName: string }> {
        try {
            return await this.post("/delEvent", {
                guildId,
                eventName,
            });
        } catch (error) {
            return {
                success: false,
                error: `EventMgr unavailable: ${error instanceof Error ? error.message : "Connection failed"}`,
                eventName,
            };
        }
    }

    /**
     * Get a specific event by name
     */
    async getEventByName(guildId: string, evName: string): Promise<GuildConfigEvent | null> {
        try {
            return await this.post<GuildConfigEvent | null>("/getEventByName", { guildId, evName });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`[EventSocket/getEventByName] Failed for guild ${guildId}, event ${evName}: ${message}`);
            return null;
        }
    }

    /**
     * Get events filtered by search terms
     */
    async getEventsByFilter(guildId: string, filterArr: string[]): Promise<GuildConfigEvent[]> {
        try {
            const response = await this.post<GuildConfigEvent[]>("/getEventsByFilter", { guildId, filterArr });
            return Array.isArray(response) ? response : [];
        } catch {
            return [];
        }
    }

    /**
     * Get all events for a guild
     */
    async getEventsByGuild(guildId: string): Promise<GuildConfigEvent[]> {
        try {
            const response = await this.post<GuildConfigEvent[]>("/getEventsByGuild", { guildId });
            return Array.isArray(response) ? response : [];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`[EventSocket/getEventsByGuild] Failed for guild ${guildId}: ${message}`);
            return [];
        }
    }

    private logThrottledError(type: string, err?: Error): void {
        const now = Date.now();
        this.errorCount++;

        if (now - this.lastErrorTime > ERROR_THROTTLE_MS) {
            const message = err?.message || "Unknown error";
            logger.error(`  [${this.shardId}] EventMgr ${type}: ${message} (${this.errorCount} errors in last minute)`);
            this.lastErrorTime = now;
            this.errorCount = 0;
        }
    }
}

// Export singleton instance
export default EventSocket.getInstance();
