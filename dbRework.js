const Sequelize = require("sequelize");
const { inspect } = require("util");
const momentTZ = require("moment-timezone");

const config = require("./config.js");

/* eslint no-unused-vars: 0 */
const init = async function() {
    const MongoClient = require("mongodb").MongoClient;
    const mongo = await MongoClient.connect("mongodb://localhost:27017/", { useNewUrlParser: true } );
    const cache = await require("./modules/cache.js")(mongo);

    const sequelize = new Sequelize(config.database.data, config.database.user, config.database.pass, {
        host: config.database.host,
        dialect: "postgres",
        logging: false,
        operatorAliases: false
    });

    const allyCodes = sequelize.define("allyCodes", {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },  
        allyCode: {
            type: Sequelize.BIGINT
        }   
    });  
    await allyCodes.sync();
    const oldAllyCodes = await allyCodes.findAll();
    
    for (const ac of oldAllyCodes) {
        const a = ac.dataValues;
        let user = config.defaultUserConf;
        user.id = a.id;
        let player = await mongo.db("swapi").collection("players").find({allyCode: parseInt(a.allyCode)}).toArray();
        if (Array.isArray(player) && player.length) player = player[0];
        user.accounts = [{
            allyCode: a.allyCode,
            name: player && player.name ? player.name : null,
            primary: true
        }];
        await mongo.db("swgohbot").collection("users").updateOne({id: a.id}, 
            {$set: user},
            {upsert: true}
        );
        user = null;
    }
    console.log("Done");
};

init();

