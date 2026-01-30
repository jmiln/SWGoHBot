import { MongoClient } from "mongodb";

let client: MongoClient | null = null;

/**
 * Returns a singleton MongoDB client connected to the test database.
 * Lazily initializes connection on first call.
 *
 * @returns Connected MongoClient instance
 * @throws Error if connection fails
 */
export async function getMongoClient(): Promise<MongoClient> {
    if (!client) {
        const url = process.env.MONGO_URL || "mongodb://localhost:27018";
        try {
            client = await MongoClient.connect(url);
        } catch (error) {
            throw new Error(
                `Failed to connect to MongoDB at ${url}. Ensure testcontainer is running.\n` +
                `Original error: ${error.message}`
            );
        }
    }
    return client;
}

/**
 * Closes the MongoDB connection and resets the singleton.
 * Safe to call multiple times.
 */
export async function closeMongoClient(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
    }
}
