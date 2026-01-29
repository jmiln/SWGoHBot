import type { Socket } from "socket.io-client";
import type { GuildConfigEvent } from "../types/guildConfig_types.ts";

const DEFAULT_TIMEOUT = 5000; // 5 seconds

export class SocketHelper {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
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
                error: `EventMgr unavailable: ${error.message || "Connection failed"}`,
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
                error: `EventMgr unavailable: ${error.message || "Connection failed"}`,
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
        } catch (_error) {
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
        } catch (_error) {
            return [];
        }
    }

    /**
     * Check if the socket is connected
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}
