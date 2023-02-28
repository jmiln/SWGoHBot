module.exports = clientMongo => {

    const mongo = clientMongo;

    return {
        wipe:    wipe,
        put:     put,
        get:     get,
        getOne:  getOne,
        remove:  remove,
        replace: replace,
        exists:  exists,
    };

    async function wipe( database, collection ) {
        if ( !database ) { throw new Error("No database specified to put"); }
        if ( !collection ) { throw new Error("No collection specified to put"); }

        const dbo = await mongo.db( database );

        //Try update or insert
        await dbo.collection(collection).deleteMany({});

        return;
    }

    async function put( database, collection, matchCondition, saveObject, autoUpdate=true ) {
        if ( !database ) { throw new Error("No database specified to put"); }
        if ( !collection ) { throw new Error("No collection specified to put"); }
        if ( !saveObject ) { throw new Error("No object provided to put"); }

        const dbo = await mongo.db( database );

        if (!saveObject.updated && autoUpdate) {
            //set updated time to now
            saveObject.updated = new Date();
            saveObject.updated = saveObject.updated.getTime();
        }

        // Use a format that works with mongo's auto-cleaning
        if (!saveObject.updatedAt && autoUpdate) {
            saveObject.updatedAt = new Date();
        }

        //Try update or insert
        matchCondition = matchCondition || {};
        await dbo.collection(collection).updateOne(matchCondition,
            { $set: saveObject },
            { upsert:true }
        );

        return saveObject;
    }

    async function get( database, collection, matchCondition, projection ) {
        if ( !database ) { throw new Error("No database specified to get"); }
        if ( !collection ) { throw new Error("No collection specified to get"); }

        const dbo = await mongo.db( database );

        matchCondition = matchCondition || {};
        projection = projection || {};
        return await dbo.collection(collection).find(matchCondition).project(projection).toArray();
    }

    async function getOne( database, collection, matchCondition, projection ) {
        if ( !database ) { throw new Error("No database specified to get"); }
        if ( !collection ) { throw new Error("No collection specified to get"); }

        const dbo = await mongo.db( database );

        matchCondition = matchCondition || {};
        projection = projection || {};
        return await dbo.collection(collection).findOne(matchCondition, {projection: projection});
    }

    async function remove( database, collection, matchCondition ) {
        if ( !database ) { throw new Error("No database specified to get"); }
        if ( !collection ) { throw new Error("No collection specified to get"); }

        const dbo = await mongo.db( database );

        matchCondition = matchCondition || {};
        const res = await dbo.collection(collection).deleteOne(matchCondition);
        return res;
    }

    async function replace( database, collection, matchCondition, saveObject, autoUpdate=true ) {
        if ( !database )        throw new Error("No database specified to replace");
        if ( !collection )      throw new Error("No collection specified to replace");
        if ( !saveObject )      throw new Error("No object provided to replace");
        if ( !matchCondition )  throw new Error("No match condition specified to replace");

        const dbo = await mongo.db( database );

        if (!saveObject.updated && autoUpdate) {
            // Set updated time to now
            saveObject.updated = new Date();
            saveObject.updated = saveObject.updated.getTime();
        }

        // Use a format that works with mongo's auto-cleaning
        if (!saveObject.updatedAt && autoUpdate) {
            saveObject.updatedAt = new Date();
        }

        // Delete the old one then replace it with the new version
        await dbo.collection(collection).replaceOne(matchCondition, saveObject, {upsert: true});

        return saveObject;
    }

    async function exists(database, collection, matchCondition) {
        if ( !database )        throw new Error("No database specified to replace");
        if ( !collection )      throw new Error("No collection specified to replace");
        if ( !matchCondition )  throw new Error("No match condition specified to replace");

        const dbo = await mongo.db( database );

        const exists = await dbo.collection(collection).findOne(matchCondition);
        return exists ? true : false;
    }
};
