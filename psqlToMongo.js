// Run this to copy over the various tables from psql to mongodb
const config = require("./config.js");
const { Sequelize } = require("sequelize");

async function init() {
    const { MongoClient } = require("mongodb");
    const mongo = await MongoClient.connect(config.mongodb.url);

    // const seqOps = Sequelize.Op;
    const database = new Sequelize(
        config.database.data,
        config.database.user,
        config.database.pass, {
            host: config.database.host,
            dialect: "postgres",
            logging: false
        }
    );
    const modelArr = ["settings", "eventDBs", "shardtimes", "polls"];
    await database.authenticate().then(async () => {
        require("./modules/models.js")(Sequelize, database);
        for (const model of modelArr) {
            await database.models[model].findAll({raw: true}).then(async (res) => {
                if (model == "settings") {
                    const diffArr = [];
                    for (const conf of res) {
                        const diffObj = {
                            guildId: conf.guildID
                        };
                        for (const key of Object.keys(config.defaultSettings)) {
                            const configVal = config.defaultSettings[key];
                            if (Array.isArray(configVal)) {
                                if (!arrayEquals(configVal, conf[key])) {
                                    diffObj[key] = conf[key];
                                }
                            } else if (config.defaultSettings[key] !== conf[key]) {
                                diffObj[key] = conf[key];
                            }
                        }
                        if (Object.keys(diffObj)?.length > 1) {
                            diffArr.push(diffObj);
                        }
                    }
                    await mongo.db(config.mongodb.swgohbotdb).collection("guildSettings").insertMany(diffArr);
                } else {
                    await mongo.db(config.mongodb.swgohbotdb).collection(model).insertMany(res);
                }
            });
        }
    });

    process.exit(1);
}

function arrayEquals(a, b) {
    if (!a?.length || !b?.length) return false;
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}


init();
