const Enmap = require('enmap');
const EnmapLevel = require('enmap-level');
const Sequelize = require('sequelize');

// const { inspect } = require('util');

const config = require('./config.json');

const guildSettings = new Enmap({ provider: new EnmapLevel({ name: 'guildSettings' })});
const guildEvents   = new Enmap({ provider: new EnmapLevel({ name: 'guildEvents' })});
// const guildChars    = new Enmap({ provider: new EnmapLevel({ name: 'guildChars' })});

/* eslint no-unused-vars: 0 */
const init = async function() {
    const sequelize = new Sequelize(config.database.data, config.database.user, config.database.pass, {
        host: config.database.host,
        dialect: 'postgres',
        logging: false,
        operatorAliases: false
    });
    const settings = sequelize.define('settings', {
        guildID: { type: Sequelize.TEXT, primaryKey: true },
        adminRole: Sequelize.ARRAY(Sequelize.TEXT),
        enableWelcome: Sequelize.BOOLEAN,
        welcomeMessage: Sequelize.TEXT,
        useEmbeds: Sequelize.BOOLEAN,
        timezone: Sequelize.TEXT,
        announceChan: Sequelize.TEXT
    });
    const events = sequelize.define('events', {
        guildID: { type: Sequelize.TEXT, primaryKey: true },
        events: Sequelize.JSONB
    });
    await settings.sync();
    await events.sync();

    guildSettings.keyArray().forEach(gID => {
        const gSet = guildSettings.get(gID);
        const gEve = guildEvents.get(gID);

        const settingTag = settings.create({
            guildID: gID,
            adminRole: gSet.adminRole,
            enableWelcome: gSet.enableWelcome,
            welcomeMessage: gSet.welcomeMessage,
            useEmbeds: gSet.useEmbeds,
            timezone: gSet.timezone,
            announceChan: gSet.announceChan
        })
            .then(() => {})
            .catch(error => { console.log(error, gID); });

        const eventTag = events.create({
            guildID: gID,
            events: gEve
        })
            .then(() => {})
            .catch(error => { console.log(error, gID); });
    });
};

init();
