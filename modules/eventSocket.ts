import { io, type Socket } from "socket.io-client";
import config from "../config.ts";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";
import logger from "./Logger.ts";

const SOCKET_CONFIG = {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 5000,
};

const ERROR_THROTTLE_MS = 60000;
const DEFAULT_TIMEOUT = 5000;

/**
 * Singleton socket.io client for cross-shard event communication.
 * Manages connection lifecycle and provides high-level API for event operations.
 */
class EventSocket {
    private static instance: EventSocket;
    private socket: Socket | null = null;
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
    connect(shardId: number): void {
        if (this.socket?.connected) {
            logger.log(`[EventSocket] Already connected on shard ${shardId}`);
            return;
        }

        this.shardId = shardId;
        this.socket = io(`ws://localhost:${config.eventServe.port}`, SOCKET_CONFIG);

        this.socket.on("connect", () => {
            logger.log(`  [${this.shardId}] Connected to EventMgr socket!`);
            this.errorCount = 0;
        });

        this.socket.on("connect_error", (err) => this.logThrottledError("connection failed", err));
        this.socket.on("reconnect_error", (err) => this.logThrottledError("reconnect failed", err));
        this.socket.on("connect_failed", (err) => this.logThrottledError("connect failed", err));
        this.socket.on("disconnect", (reason) => {
            logger.log(`  [${this.shardId}] EventMgr disconnected: ${reason}`);
        });
    }

    /**
     * Disconnect and cleanup the socket
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            logger.log(`  [${this.shardId}] Socket.io disconnected`);
        }
    }

    /**
     * Check if socket is connected
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Emit a socket event and wait for the callback with timeout
     */
    private emit<T>(event: string, data?: unknown, timeout = DEFAULT_TIMEOUT): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.socket.connected) {
                reject(new Error("Socket not connected"));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`Socket timeout after ${timeout}ms for event: ${event}`));
            }, timeout);

            const callback = (response: T) => {
                clearTimeout(timeoutId);
                resolve(response);
            };

            if (data !== undefined) {
                this.socket.emit(event, data, callback);
            } else {
                this.socket.emit(event, callback);
            }
        });
    }

    /**
     * Check for events that need to be triggered
     */
    async checkEvents(): Promise<GuildConfigEvent[]> {
        const events = await this.emit<GuildConfigEvent[]>("checkEvents");
        return Array.isArray(events) ? events : [];
    }

    /**
     * Add one or more events to a guild
     */
    async addEvents(
        guildId: string,
        events: GuildConfigEvent | GuildConfigEvent[],
    ): Promise<{ success: boolean; error: string; event: GuildConfigEvent }[]> {
        try {
            const response = await this.emit<{ success: boolean; error: string; event: GuildConfigEvent }[]>("addEvents", {
                guildId,
                events,
            });
            return response;
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
            const response = await this.emit<{ success: boolean; error?: string; eventName: string }>("delEvent", {
                guildId,
                eventName,
            });
            return response;
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
            const response = await this.emit<GuildConfigEvent>("getEventByName", { guildId, evName });
            return response || null;
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
        return new Promise<GuildConfigEvent[]>((resolve) => {
            if (!this.socket || !this.socket.connected) {
                resolve([]);
                return;
            }

            const timeoutId = setTimeout(() => {
                resolve([]);
            }, DEFAULT_TIMEOUT);

            this.socket.emit("getEventsByFilter", guildId, filterArr, (response: GuildConfigEvent[]) => {
                clearTimeout(timeoutId);
                resolve(Array.isArray(response) ? response : []);
            });
        });
    }

    /**
     * Get all events for a guild
     */
    async getEventsByGuild(guildId: string): Promise<GuildConfigEvent[]> {
        try {
            const response = await this.emit<GuildConfigEvent[]>("getEventsByGuild", guildId);
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
