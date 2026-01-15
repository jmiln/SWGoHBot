import type { AnyBulkWriteOperation, Document, Filter, MongoClient } from "mongodb";

export default (clientMongo: MongoClient) => {
    return {
        checkIndexes,
        exists,
        get,
        getOne,
        put,
        putMany,
        remove,
        replace,
    };

    async function put(database: string, collection: string, matchCondition: Filter<Document>, saveObject: Document, autoUpdate = true) {
        if (!database) throw new Error("No database specified to put");
        if (!collection) throw new Error("No collection specified to put");
        if (!matchCondition) throw new Error("No match condition specified to put");
        if (!saveObject) throw new Error("No object provided to put");

        const dbo = clientMongo.db(database);

        if (autoUpdate) {
            saveObject.updated = Date.now();
            saveObject.updatedAt = new Date();
        }

        await dbo.collection(collection).updateOne(matchCondition, { $set: saveObject }, { upsert: true });

        return saveObject;
    }

    async function putMany(database: string, collection: string, saveObjectArray: readonly AnyBulkWriteOperation<Document>[]) {
        if (!database) throw new Error("No database specified to putMany");
        if (!collection) throw new Error("No collection specified to putMany");
        if (!saveObjectArray?.length) throw new Error("Object array is empty or missing");

        const dbo = clientMongo.db(database);

        return await dbo.collection(collection).bulkWrite(saveObjectArray);
    }

    async function get(database: string, collection: string, matchCondition: Filter<Document>, projection: Document, limit = 0) {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");
        if (!matchCondition) throw new Error("No match condition specified to get");

        const dbo = clientMongo.db(database);
        return await dbo
            .collection(collection)
            .find(matchCondition)
            .limit(limit)
            .project(projection || {})
            .toArray();
    }

    async function getOne<T>(database: string, collection: string, matchCondition: Filter<T>, projection: Partial<Record<keyof T, 1 | 0>>) {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");
        if (!matchCondition) throw new Error("No match condition specified to get");

        const dbo = clientMongo.db(database);
        return await dbo.collection<T>(collection).findOne(matchCondition, { projection: projection || {} });
    }

    async function remove(database: string, collection: string, matchCondition: Filter<Document>) {
        if (!database) throw new Error("No database specified to remove");
        if (!collection) throw new Error("No collection specified to remove");
        if (!matchCondition) throw new Error("No match condition specified to remove");

        const dbo = clientMongo.db(database);
        return await dbo.collection(collection).deleteOne(matchCondition);
    }

    async function replace(
        database: string,
        collection: string,
        matchCondition: Filter<Document>,
        saveObject: Document,
        autoUpdate = true,
    ) {
        if (!database) throw new Error("No database specified to replace");
        if (!collection) throw new Error("No collection specified to replace");
        if (!saveObject) throw new Error("No object provided to replace");
        if (!matchCondition) throw new Error("No match condition specified to replace");

        const dbo = clientMongo.db(database);

        if (autoUpdate) {
            saveObject.updated = Date.now();
            saveObject.updatedAt = new Date();
        }

        await dbo.collection(collection).replaceOne(matchCondition, saveObject, { upsert: true });

        return saveObject;
    }

    async function exists(database: string, collection: string, matchCondition: Filter<Document>) {
        if (!database) throw new Error("No database specified to check the existence of");
        if (!collection) throw new Error("No collection specified to check the existence of");
        if (!matchCondition) throw new Error("No match condition specified to check the existence of");

        const dbo = clientMongo.db(database);

        const exists = await dbo.collection(collection).findOne(matchCondition);
        return !!exists;
    }

    async function checkIndexes(database: string, collection: string) {
        const dbo = clientMongo.db(database);
        return await dbo.collection(collection).listIndexes().toArray();
    }
};
