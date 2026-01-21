import type { AnyBulkWriteOperation, BulkWriteResult, DeleteResult, Document, Filter } from "mongodb";

export interface BotCache {
    checkIndexes: (database: string, collection: string) => Promise<Document[]>;
    exists: (database: string, collection: string, matchCondition: Filter<Document>) => Promise<boolean>;
    get: <T>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
        limit?: number,
    ) => Promise<T[]>;
    getOne: <T>(
        database: string,
        collection: string,
        matchCondition: Filter<T>,
        projection?: Partial<Record<keyof T, 0 | 1>>,
    ) => Promise<T>;
    put: <T>(database: string, collection: string, matchCondition: Filter<T>, saveObject: T, autoUpdate?: boolean) => Promise<T>;
    putMany: <T>(database: string, collection: string, saveObjectArray: readonly AnyBulkWriteOperation<T>[]) => Promise<BulkWriteResult>;
    remove: <T>(database: string, collection: string, matchCondition: Filter<T>) => Promise<DeleteResult>;
}
