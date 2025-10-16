import type { AnyBulkWriteOperation, DeleteResult, Document, Filter, ListIndexesCursor } from "mongodb";

export interface BotCache {
    checkIndexes: (database: string, collection: string) => Promise<ListIndexesCursor[]>;
    exists: (database: string, collection: string, matchCondition: Filter<Document>) => Promise<boolean>;
    get: (
        database: string,
        collection: string,
        matchCondition: Filter<Document>,
        projection: Document,
        limit?: number,
    ) => Promise<Document[]>;
    getOne: (database: string, collection: string, matchCondition: Filter<Document>, projection: Document) => Promise<Document>;
    put: (
        database: string,
        collection: string,
        matchCondition: Filter<Document>,
        saveObject: Document,
        autoUpdate?: boolean,
    ) => Promise<Document>;
    putMany: (database: string, collection: string, saveObjectArray: readonly AnyBulkWriteOperation<Document>[]) => Promise<Document[]>;
    remove: (database: string, collection: string, matchCondition: Filter<Document>) => Promise<DeleteResult>;
    replace: (
        database: string,
        collection: string,
        matchCondition: Filter<Document>,
        saveObject: Document,
        autoUpdate?: boolean,
    ) => Promise<Document>;
}
