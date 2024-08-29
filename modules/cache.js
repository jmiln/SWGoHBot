module.exports = (clientMongo) => {
    const mongo = clientMongo;

    return {
        checkIndexes: checkIndexes,
        exists: exists,
        get: get,
        getOne: getOne,
        put: put,
        putMany: putMany,
        remove: remove,
        replace: replace,
    };

    async function put(database, collection, matchCondition, saveObject, autoUpdate = true) {
        if (!database) throw new Error("No database specified to put");
        if (!collection) throw new Error("No collection specified to put");
        if (!saveObject) throw new Error("No object provided to put");

        const dbo = await mongo.db(database);

        if (autoUpdate) {
            //set updated time to now
            saveObject.updated = Date.now();
            saveObject.updatedAt = new Date();
        }

        //Try update or insert
        await dbo.collection(collection).updateOne(matchCondition || {}, { $set: saveObject }, { upsert: true });

        return saveObject;
    }

    // Getting it to work with bulkWrite
    async function putMany(database, collection, saveObjectArray) {
        if (!database) throw new Error("No database specified to putMany");
        if (!collection) throw new Error("No collection specified to putMany");
        if (!saveObjectArray?.length) throw new Error("Object array is empty or missing");

        const dbo = await mongo.db(database);

        await dbo.collection(collection).bulkWrite(saveObjectArray);
        return saveObjectArray;
    }

    async function get(database, collection, matchCondition, projection) {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");

        const dbo = await mongo.db(database);
        return await dbo
            .collection(collection)
            .find(matchCondition || {})
            .project(projection || {})
            .toArray();
    }

    async function getOne(database, collection, matchCondition, projection) {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");

        const dbo = await mongo.db(database);
        return await dbo.collection(collection).findOne(matchCondition || {}, { projection: projection || {} });
    }

    async function remove(database, collection, matchCondition) {
        if (!database) throw new Error("No database specified to get");
        if (!collection) throw new Error("No collection specified to get");

        const dbo = await mongo.db(database);
        return await dbo.collection(collection).deleteOne(matchCondition || {});
    }

    async function replace(database, collection, matchCondition, saveObject, autoUpdate = true) {
        if (!database) throw new Error("No database specified to replace");
        if (!collection) throw new Error("No collection specified to replace");
        if (!saveObject) throw new Error("No object provided to replace");
        if (!matchCondition) throw new Error("No match condition specified to replace");

        const dbo = await mongo.db(database);

        if (autoUpdate) {
            //set updated time to now
            saveObject.updated = Date.now();
            saveObject.updatedAt = new Date();
        }

        // Delete the old one then replace it with the new version
        await dbo.collection(collection).replaceOne(matchCondition, saveObject, { upsert: true });

        return saveObject;
    }

    async function exists(database, collection, matchCondition) {
        if (!database) throw new Error("No database specified to replace");
        if (!collection) throw new Error("No collection specified to replace");
        if (!matchCondition) throw new Error("No match condition specified to replace");

        const dbo = await mongo.db(database);

        const exists = await dbo.collection(collection).findOne(matchCondition);
        return !!exists;
    }

    async function checkIndexes(database, collection) {
        const out = [];
        const dbo = await mongo.db(database);

        const indexes = await dbo.collection(collection).listIndexes().toArray();

        for (const index of indexes) {
            out.push(index);
        }
        return out;
    }
};
