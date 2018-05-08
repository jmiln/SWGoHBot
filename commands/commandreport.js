const Command = require('../base/Command');
const moment = require('moment');
const { Op } = require('sequelize');

class CommandReport extends Command {
    constructor(client) {
        super(client, {
            name: 'commandreport',
            category: "Dev",
            enabled: true, 
            aliases: ['comreport', 'cr'],
            permissions: ['EMBED_LINKS'],   
            permLevel: 10
        });
    }

    async run(client, message) { // eslint-disable-line no-unused-vars
        const commands = await client.commandLogs.findAll({
            where: {
                updatedAt: {
                    [Op.gte]: moment().subtract(10, 'days').toDate()
                }
            }
        });

        const coms = {};
        for (let ix = 0; ix < commands.length; ix++) {
            const com = commands[ix].id.split('-')[0];
            if (!coms[com]) {
                coms[com] = 1;
            } else {
                coms[com] = coms[com] + 1;
            }
        }
        const comArr = [];
        const comKeys = Object.keys(coms);
        const longest = comKeys.reduce((long, str) => Math.max(long, str.length), 0);
        const sortedComs = comKeys.sort((p, c) => coms[p] < coms[c] ? 1 : -1);
        sortedComs.forEach(com => {
            comArr.push(`${com + ' '.repeat(longest - com.length)} : ${coms[com]}`);
        });
        message.channel.send({embed: {
            author: {
                name: 'Command report for the last 10 days'
            },
            description: '```' + comArr.join('\n') + '```'
        }});
    }
}

module.exports = CommandReport;

