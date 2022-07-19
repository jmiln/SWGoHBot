
module.exports = (Sequelize, database) => {
    // Models
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
