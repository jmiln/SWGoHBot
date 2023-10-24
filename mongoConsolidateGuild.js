const config = require("./config.js");
const { inspect } = require("util");

async function init() {
    const { MongoClient } = require("mongodb");
    const mongo = await MongoClient.connect(config.mongodb.url);

    const oldTables = {
        guildSettings: "settings",
        eventDBs     : "events",
        polls        : "polls",
        shardtimes   : "shardtimes"
    };

    const out = [];

    for (const table of Object.keys(oldTables)) {
        const collection = await mongo.db(config.mongodb.swgohbotdb).collection(table).find().toArray();
        for (let entry of collection) {
            // Grab any old entry for this guild
            const thisGuildId = getGuildId(table, entry);
            const oldGuildIndex =  out.findIndex(gConf => gConf.guildId === thisGuildId)
            const thisGuild = oldGuildIndex > -1 ? out[oldGuildIndex] : {guildId: thisGuildId, events: [], polls: [], shardtimes: []};

            // Copy the entry
            let entryCopy = JSON.parse(JSON.stringify(entry));

            // Delete mongo bits that we don't need to have carried over
            delete entryCopy._id;
            delete entryCopy.createdAt;
            delete entryCopy.updatedAt;
            delete entryCopy.updated;

            if (table === "guildSettings") {
                delete entryCopy.guildId;
            }

            if (table === "eventDBs") {
                // Grab just the event name out of the ID then add it to the events array
                entryCopy.name = entryCopy.eventID.split("-").slice(1).join("-");
                delete entryCopy.eventID;
                thisGuild[oldTables[table]].push(entryCopy);
            } else if (["polls", "shardtimes"].includes(table)) {
                // Grab just the channel ID from the id then add it to it's array
                entryCopy.channelId = entryCopy.id.split("-")[1];
                delete entryCopy.id;

                if (table === "polls") {
                    entryCopy.poll.channelId = entryCopy.channelId;
                    thisGuild[oldTables[table]].push(entryCopy.poll);
                } else {
                    thisGuild[oldTables[table]].push(entryCopy);
                }
            } else {
                thisGuild[oldTables[table]] = entryCopy;
            }

            if (oldGuildIndex > -1) {
                // If there's already info for the guild, update it
                out[oldGuildIndex] = thisGuild;
            } else {
                // Otherwise, put it in fresh
                out.push(thisGuild);
            }
        }
    }

    // Send the settings to mongo
    await mongo.db(config.mongodb.swgohbotdb).collection("guildConfigs").insertMany(out);
    console.log("Finished");
}


function getGuildId(tableName, obj) {
    switch (tableName) {
        case "guildSettings":
            return obj.guildId;
        case "eventDBs":
            // console.log(obj);
            return obj.eventID.split("-")[0]
        case "polls":
        case "shardtimes":
            return obj.id.split("-")[0]
    }
}


init();










