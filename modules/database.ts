import { MongoClient } from "mongodb";
import { myTime } from "./functions.ts";

/**
 * Singleton MongoDB connection manager
 * Provides centralized database connection handling across the application
 */
class Database {
    private client: MongoClient | null = null;

    /**
     * Initialize MongoDB connection
     * @param url - MongoDB connection URL
     * @throws Error if connection fails
     */
    async connect(url: string): Promise<void> {
        if (this.client) {
            console.warn(`[${myTime()}] MongoDB already connected`);
            return;
        }

        try {
            this.client = await MongoClient.connect(url);
            console.log(`[${myTime()}] Connected to MongoDB`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[${myTime()}] Failed to connect to MongoDB: ${errorMsg}`);
            throw err;
        }
    }

    /**
     * Get the MongoDB client instance
     * @throws Error if client is not initialized
     */
    getClient(): MongoClient {
        if (!this.client) {
            throw new Error("MongoDB client not initialized. Call connect() first.");
        }
        return this.client;
    }

    /**
     * Close MongoDB connection gracefully
     */
    async close(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await this.client.close();
            console.log(`[${myTime()}] MongoDB connection closed`);
            this.client = null;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[${myTime()}] Error closing MongoDB: ${errorMsg}`);
            throw err;
        }
    }

    /**
     * Check if database is connected
     */
    isConnected(): boolean {
        return this.client !== null;
    }
}

// Export singleton instance
const database = new Database();
export default database;
