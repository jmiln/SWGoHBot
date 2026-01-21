import type { AnyBulkWriteOperation, BulkWriteResult, DeleteResult, Document, Filter, ListIndexesCursor, MongoClient } from "mongodb";
import type { BotCache } from "../types/cache_types.ts";

class Cache implements BotCache {
    private mongo!: MongoClient;

    /**
     * Initialize the Cache module with MongoDB client dependency
     */
    init(clientMongo: MongoClient): void {
        this.mongo = clientMongo;
    }

    async put<T>(database: string, collection: string, matchCondition: Filter<T>, saveObject: T, autoUpdate = true): Promise<T> {
        if (!database) throw new Error("No database specified to put");
        if (!collection) throw new Error("No collection specified to put");
        if (!matchCondition) throw new Error("No match condition specified to put");
        if (!saveObject) throw new Error("No object provided to put");

        const dbo = this.mongo.db(database);

        if (autoUpdate) {
            (saveObject as Document).updated = Date.now();
            (saveObject as Document).updatedAt = new Date();
        }

        // Remove _id from the update object to avoid "immutable field '_id'" error
        const { _id, ...updateObject } = saveObject as Document;

        await dbo.collection(collection).updateOne(matchCondition, { $set: updateObject }, { upsert: true });

        return saveObject;
    }

    async putMany<T>(database: string, collection: string, saveObjectArray: readonly AnyBulkWriteOperation<T>[]): Promise<BulkWriteResult> {
        if (!database) throw new Error("No database specified to putMany");
        if (!collection) throw new Error("No collection specified to putMany");
        if (!saveObjectArray?.length) throw new Error("Object array is empty or missing");

        const dbo = this.mongo.db(database);

        return await dbo.collection(collection).bulkWrite(saveObjectArray as AnyBulkWriteOperation<Document>[]);
    }

    async get<T>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
        limit = 0,
    ): Promise<T[]> {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");
        if (!matchCondition) throw new Error("No match condition specified to get");

        const dbo = this.mongo.db(database);
        return (await dbo
            .collection(collection)
            .find(matchCondition)
            .limit(limit)
            .project(projection || {})
            .toArray()) as T[];
    }

    async getAggregate<T>(database: string, collection: string, aggregate: Document[]): Promise<T[]> {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");
        if (!aggregate) throw new Error("No aggregate specified to get");

        const dbo = this.mongo.db(database);
        return (await dbo.collection(collection).aggregate(aggregate).toArray()) as T[];
    }

    async getOne<T>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
    ): Promise<T> {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");
        if (!matchCondition) throw new Error("No match condition specified to get");

        const dbo = this.mongo.db(database);
        return (await dbo.collection<T>(collection).findOne(matchCondition, { projection: projection || {} })) as T;
    }

    async remove<T>(database: string, collection: string, matchCondition: Filter<T>): Promise<DeleteResult> {
        if (!database) throw new Error("No database specified to remove");
        if (!collection) throw new Error("No collection specified to remove");
        if (!matchCondition) throw new Error("No match condition specified to remove");

        const dbo = this.mongo.db(database);
        return await dbo.collection(collection).deleteOne(matchCondition);
    }

    async replace<T>(database: string, collection: string, matchCondition: Filter<T>, saveObject: T, autoUpdate = true): Promise<T> {
        if (!database) throw new Error("No database specified to replace");
        if (!collection) throw new Error("No collection specified to replace");
        if (!saveObject) throw new Error("No object provided to replace");
        if (!matchCondition) throw new Error("No match condition specified to replace");

        const dbo = this.mongo.db(database);

        if (autoUpdate) {
            (saveObject as Document).updated = Date.now();
            (saveObject as Document).updatedAt = new Date();
        }

        // Remove _id from the replacement object to avoid "immutable field '_id'" error
        const { _id, ...replaceObject } = saveObject as Document;

        await dbo.collection(collection).replaceOne(matchCondition, replaceObject, { upsert: true });

        return saveObject;
    }

    async exists(database: string, collection: string, matchCondition: Filter<Document>): Promise<boolean> {
        if (!database) throw new Error("No database specified to check the existence of");
        if (!collection) throw new Error("No collection specified to check the existence of");
        if (!matchCondition) throw new Error("No match condition specified to check the existence of");

        const dbo = this.mongo.db(database);

        const exists = await dbo.collection(collection).findOne(matchCondition);
        return !!exists;
    }

    async checkIndexes(database: string, collection: string): Promise<ListIndexesCursor[]> {
        const dbo = this.mongo.db(database);
        return await dbo.collection(collection).listIndexes().toArray();
    }
}

// Create and export a singleton instance
const cache = new Cache();

export default cache;
export { Cache };
