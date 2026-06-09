import { env } from "../config/config.ts";
import type { BotCache } from "../types/cache_types.ts";
import type { ArenaPlayer } from "../types/types.ts";

export class ArenaPlayerRegistry {
    private cache!: BotCache;

    /**
     * Initialize the ArenaPlayerRegistry module with cache dependency
     */
    init(cache: BotCache): void {
        this.cache = cache;
    }

    /**
     * Fetch a single arena player by ally code.
     * Returns null if the player is not found.
     */
    async getPlayer(allyCode: number): Promise<ArenaPlayer | null> {
        const doc = (await this.cache.getOne(env.MONGODB_SWGOHBOT_DB, "arenaPlayers", { allyCode })) as ArenaPlayer | null;
        return doc ?? null;
    }

    /**
     * Fetch multiple arena players by ally code, returned as a Map keyed by allyCode.
     * Missing codes are simply absent from the Map.
     */
    async batchGet(allyCodes: number[]): Promise<Map<number, ArenaPlayer>> {
        if (!allyCodes.length) return new Map();
        const docs = (await this.cache.get(env.MONGODB_SWGOHBOT_DB, "arenaPlayers", {
            allyCode: { $in: allyCodes },
        })) as ArenaPlayer[];
        const map = new Map<number, ArenaPlayer>();
        for (const doc of docs ?? []) {
            map.set(doc.allyCode, doc);
        }
        return map;
    }

    /**
     * Insert or update a single arena player document.
     */
    async upsertPlayer(data: ArenaPlayer): Promise<void> {
        await this.cache.put(env.MONGODB_SWGOHBOT_DB, "arenaPlayers", { allyCode: data.allyCode }, data, false);
    }

    /**
     * Bulk insert or update multiple arena player documents.
     * No-op when given an empty array.
     */
    async batchUpsert(players: ArenaPlayer[]): Promise<void> {
        if (!players.length) return;
        const ops = players.map((p) => ({
            updateOne: {
                filter: { allyCode: p.allyCode },
                update: { $set: p },
                upsert: true,
            },
        }));
        await this.cache.putMany(env.MONGODB_SWGOHBOT_DB, "arenaPlayers", ops);
    }
}

// Singleton instance for use throughout the bot
const arenaPlayerRegistry = new ArenaPlayerRegistry();
export default arenaPlayerRegistry;
