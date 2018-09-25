const Sequelize = require("sequelize");
const { inspect } = require("util");
const momentTZ = require("moment-timezone");

const config = require("./config.json");

/* eslint no-unused-vars: 0 */
const init = async function() {
    const sequelize = new Sequelize(config.database.data, config.database.user, config.database.pass, {
        host: config.database.host,
        dialect: "postgres",
        logging: false,
        operatorAliases: false
    });

    const guildSettings = sequelize.define("settings", {
        guildID: { type: Sequelize.TEXT, primaryKey: true },
        adminRole: Sequelize.ARRAY(Sequelize.TEXT),
        enableWelcome: Sequelize.BOOLEAN,
        welcomeMessage: Sequelize.TEXT,
        useEmbeds: Sequelize.BOOLEAN,
        timezone: Sequelize.TEXT,
        announceChan: Sequelize.TEXT,
        useEventPages: Sequelize.BOOLEAN,
        language: Sequelize.TEXT
    });

    const events = sequelize.define("events", {
        guildID: { type: Sequelize.TEXT, primaryKey: true },
        events: Sequelize.JSONB
    });

    const guildEvents = sequelize.define("eventDB", {
        eventID: { type: Sequelize.TEXT, primaryKey: true },
        eventDT: Sequelize.TEXT,
        eventMessage: Sequelize.TEXT,
        eventChan: Sequelize.TEXT,
        countdown: Sequelize.TEXT,
        repeat: Sequelize.JSONB,
        repeatDays: Sequelize.ARRAY(Sequelize.TEXT)
    });

    await guildSettings.sync();
    await events.sync();
    await guildEvents.sync();

    let ix = 0;

    const oldEvents = await events.findAll();
    // console.log('HERE: ' + inspect(oldEvents));

    oldEvents.forEach(async guild => {
        const settings = await guildSettings.findOne({where: {guildID: guild.guildID}, attributes: ["timezone", "language"]});
        const guildConf = settings.dataValues;

        const gEvents = guild.events;
        Object.keys(gEvents).forEach(async eventName => {
            const thisEvent = gEvents[eventName];
            const newEvent = {
                "eventID": `${guild.guildID}-${eventName}`,
                "eventDT": momentTZ.tz(`${thisEvent.eventDay} ${thisEvent.eventTime}`, "YYYY-MM-DD HH:mm", guildConf.timezone).unix()*1000,
                "eventMessage": thisEvent.eventMessage,
                "eventChan": thisEvent.eventChan,
                "countdown": thisEvent.countdown,
                "repeat": {
                    "repeatDay": thisEvent.repeat["repeatDay"],
                    "repeatHour": thisEvent.repeat["repeatHour"],
                    "repeatMin": thisEvent.repeat["repeatMin"]
                },
                "repeatDays": thisEvent.repeatDays
            };
            await guildEvents.create(newEvent);
        });
        console.log(`Finished ${ix++}`);

    });
};

init();

