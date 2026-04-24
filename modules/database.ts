import { MongoClient } from "mongodb";
import logger from "./Logger.ts";

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
            logger.warn("MongoDB already connected");
            return;
        }

        try {
            this.client = await MongoClient.connect(url);
            logger.log("Connected to MongoDB");
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to connect to MongoDB: ${errorMsg}`);
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
            logger.log("MongoDB connection closed");
            this.client = null;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Error closing MongoDB: ${errorMsg}`);
            throw err;
        }
    }

    /**
     * Check if database is connected
     */
    isConnected(): boolean {
        return this.client !== null;
    }

    /**
     * Initialize with an existing MongoDB client (for testing)
     * @param client - Pre-configured MongoClient instance
     */
    init(client: MongoClient): void {
        this.client = client;
    }
}

// Export singleton instance
const database = new Database();
export default database;
