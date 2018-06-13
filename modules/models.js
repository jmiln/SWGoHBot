
module.exports = (Sequelize, database) => {
    // Models
    database.define('settings', {
        guildID: { 
            type: Sequelize.TEXT, 
            primaryKey: true 
        },
        adminRole: {
            type: Sequelize.ARRAY(Sequelize.TEXT),
            defaultValue: ['Administrator']
        },
        enableWelcome: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        welcomeMessage: {
            type: Sequelize.TEXT,
            defaultValue: "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D"
        },
        useEmbeds: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
        timezone: {
            type: Sequelize.TEXT,
            defaultValue: 'GMT'
        },
        announceChan: {
            type: Sequelize.TEXT
        },
        useEventPages: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        language: {
            type: Sequelize.TEXT,
            defaultValue: "en_US"
        }
    });

    database.define('eventDBs', {
        eventID: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        eventDT: {
            type: Sequelize.TEXT
        },
        eventMessage: {
            type: Sequelize.TEXT,
            defaultValue: ""
        },
        eventChan: {
            type: Sequelize.TEXT
        },
        countdown: {
            type: Sequelize.TEXT
        },
        repeat: {
            type: Sequelize.JSONB
        },
        repeatDays: {
            type: Sequelize.ARRAY(Sequelize.TEXT)
        }
    });
    database.define('commands', {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        commandText: {
            type: Sequelize.TEXT
        } 
    });
    database.define('changelogs', {
        logText: {
            type: Sequelize.TEXT
        }
    });
    database.define('shardtimes', {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        times: {
            type: Sequelize.JSONB,
            defaultValue: {}
        }
    });
    database.define('polls', {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        poll: {
            type: Sequelize.JSONB,
            defaultValue: {}
        }
    });
    database.define('allyCodes', {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        allyCode: {
            type: Sequelize.BIGINT
        }
    });

    database.sync();
};
