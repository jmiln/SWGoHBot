import type { AnyBulkWriteOperation, BulkWriteResult, DeleteResult, Document, Filter } from "mongodb";

export interface BotCache {
    checkIndexes: (database: string, collection: string) => Promise<Document[]>;
    exists: (database: string, collection: string, matchCondition: Filter<Document>) => Promise<boolean>;
    get: <T extends Document>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
        limit?: number,
    ) => Promise<T[]>;
    getOne: <T extends Document>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
    ) => Promise<T | null>;
    put: <T extends Document>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        saveObject: T,
        autoUpdate?: boolean,
        // Pass false when writing a partial document - see the note on Cache.put
        upsert?: boolean,
    ) => Promise<T>;
    putMany: <T extends Document>(
        database: string,
        collection: string,
        saveObjectArray: readonly AnyBulkWriteOperation<T>[],
    ) => Promise<BulkWriteResult>;
    remove: (database: string, collection: string, matchCondition: Filter<Document>) => Promise<DeleteResult>;
}
