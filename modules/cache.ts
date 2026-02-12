import type {
    AnyBulkWriteOperation,
    BulkWriteResult,
    Collection,
    DeleteResult,
    Document,
    Filter,
    MatchKeysAndValues,
    MongoClient,
} from "mongodb";
import type { BotCache } from "../types/cache_types.ts";

// Define a common interface for things stored in cache
interface Cacheable {
    updated?: number;
    updatedAt?: Date;
    // MongoDB's ObjectId - type varies (string, ObjectId, etc.)
    _id?: unknown;
    // Allow any additional properties for MongoDB partial updates
    // Must use 'any' here to match MongoDB's Document type signature for compatibility
    // biome-ignore lint/suspicious/noExplicitAny: Required for MongoDB Document compatibility
    [key: string]: any;
}

class Cache implements BotCache {
    private mongo!: MongoClient;

    /**
     * Initialize the Cache module with MongoDB client dependency
     */
    init(clientMongo: MongoClient): void {
        this.mongo = clientMongo;
    }

    private getCol<T extends Document>(dbName: string | undefined, collection: string): Collection<T> {
        if (!dbName) throw new Error("Database name must be provided.");
        return this.mongo.db(dbName).collection<T>(collection);
    }

    async put<T extends Cacheable>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        saveObject: T,
        autoUpdate = true,
    ): Promise<T> {
        const col = this.getCol<T>(database, collection);

        if (autoUpdate) {
            saveObject.updated = Date.now();
            saveObject.updatedAt = new Date();
        }

        // Destructure to ensure _id isn't sent in the $set payload
        const { _id, ...updateData } = saveObject;

        await col.updateOne(matchCondition, { $set: updateData as MatchKeysAndValues<T> }, { upsert: true });

        return saveObject;
    }

    async putMany<T extends Document>(
        database: string,
        collection: string,
        saveObjectArray: readonly AnyBulkWriteOperation<T>[],
    ): Promise<BulkWriteResult> {
        if (!saveObjectArray?.length) {
            throw new Error("Object array is empty or missing");
        }

        const col = this.getCol<T>(database, collection);
        return await col.bulkWrite(saveObjectArray as AnyBulkWriteOperation<T>[]);
    }

    async get<T extends Document>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Document,
        limit = 0,
    ): Promise<T[]> {
        return (await this.getCol<T>(database, collection)
            .find(matchCondition)
            .limit(limit)
            .project(projection || {})
            .toArray()) as unknown as T[];
    }

    async getAggregate<T extends Document>(database: string, collection: string, aggregate: Document[]): Promise<T[]> {
        const col = this.getCol<T>(database, collection);
        return (await col.aggregate(aggregate).toArray()) as unknown as T[];
    }

    async getOne<T extends Document>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Document,
    ): Promise<T | null> {
        return (await this.getCol<T>(database, collection).findOne(matchCondition, { projection })) as unknown as T;
    }

    async remove(database: string, collection: string, matchCondition: Filter<Document>): Promise<DeleteResult> {
        return await this.getCol(database, collection).deleteOne(matchCondition);
    }

    async delete(database: string, collection: string, matchCondition: Filter<Document>): Promise<DeleteResult> {
        return await this.getCol(database, collection).deleteMany(matchCondition);
    }

    async count(database: string, collection: string, matchCondition: Filter<Document>): Promise<number> {
        return await this.getCol(database, collection).countDocuments(matchCondition);
    }

    async exists(database: string, collection: string, matchCondition: Filter<Document>): Promise<boolean> {
        const count = await this.getCol(database, collection).countDocuments(matchCondition, { limit: 1 });
        return count > 0;
    }

    async checkIndexes(database: string, collection: string): Promise<Document[]> {
        const col = this.getCol(database, collection);
        return await col.listIndexes().toArray();
    }
}

// Create and export a singleton instance
const cache = new Cache();

export default cache;
export { Cache };
