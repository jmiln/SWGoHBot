
module.exports = (Sequelize, database) => {
    // Models
    database.define("settings", {
        guildID: {          // The guild's ID
            type: Sequelize.TEXT,
            primaryKey: true
        },
        prefix: {           // The guild's prefix
            type: Sequelize.TEXT,
            defaultValue: ";"
        },
        adminRole: {        // Admin roles
            type: Sequelize.ARRAY(Sequelize.TEXT),
            defaultValue: ["Administrator"]
        },
        enableWelcome: {    // Toggle welcome message on/ off
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        welcomeMessage: {   // Welcome message
            type: Sequelize.TEXT,
            defaultValue: "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D"
        },
        enablePart: {       // Toggle parting message on/ off
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        partMessage: {      // Parting message
            type: Sequelize.TEXT,
            defaultValue: "Goodbye {{user}}, thanks for stopping by!"
        },
        useEmbeds: {        // Use embeds? (Only turned off on one guild)
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
        timezone: {         // Guild's timezone
            type: Sequelize.TEXT,
            defaultValue: "GMT"
        },
        announceChan: {     // Announcement channel
            type: Sequelize.TEXT
        },
        useEventPages: {    // Paginate events
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        eventCountdown: {   // Custom countdowns (Minutes)
            type: Sequelize.ARRAY(Sequelize.INTEGER),
            defaultValue: [2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5]
        },
        language: {         // Command strings language
            type: Sequelize.TEXT,
            defaultValue: "en_US"
        },
        swgohLanguage: {    // Live-data language
            type: Sequelize.TEXT,
            defaultValue: "ENG_US"
        },
        shardtimeVertical: {// Align registered shardmates vertically or not
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        useActivityLog: {// Use the activity logs or not
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        changelogWebhook: {     // Webhook to send changelogs to
            type: Sequelize.TEXT,
            defaultValue: ""
        }
    });

    database.define("eventDBs", {
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
    database.define("commands", {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        commandText: {
            type: Sequelize.TEXT
        }
    });
    database.define("changelogs", {
        logText: {
            type: Sequelize.TEXT
        }
    });
    database.define("shardtimes", {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        times: {
            type: Sequelize.JSONB,
            defaultValue: {}
        }
    });
    database.define("polls", {
        id: {
            type: Sequelize.TEXT,
            primaryKey: true
        },
        poll: {
            type: Sequelize.JSONB,
            defaultValue: {}
        },
        pollId: {
            type: Sequelize.INTEGER,
            autoIncrement: true
        }
    });

    database.sync();
};
