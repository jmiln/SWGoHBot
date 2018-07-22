const moment = require("moment");
require("moment-duration-format");
const Command = require('../base/Command');

class Stats extends Command {
    constructor(client) {
        super(client, {
            name: 'stats',
            permLevel: 3,
            category: 'Admin'
        });
    }

    async run(client, message) {
        const duration = moment.duration(client.uptime).format(" D [days], H [hrs], m [mins], s [secs]");
        const guilds = await client.guildCount();
        let users = 0;
        let channels = 0;

        const playerCount = await client.swgohAPI.report('countCollection', {collection:'players', distinct:'allyCode'}, 'ENG_US');
        const guildCount = await client.swgohAPI.report('countCollection', {collection:'players', distinct:'guildName'}, 'ENG_US');
        const languageCount = await client.swgohAPI.report('countCollection', {collection:'localization', distinct:'language'}, 'ENG_US');
        let lastUpdated = await client.swgohAPI.report('getLastUpdated', {collection:'localization', match:{ 'language':'ENG_US' }}, 'ENG_US');
        lastUpdated = moment(lastUpdated[0].updated).format('ddd, MMM Do YYYY');

        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues('channels.size')
                .then(results => {
                    channels = results.reduce((prev, val) => prev + val, 0).toLocaleString();
                })
                .catch(console.error);
            await client.shard.fetchClientValues('users.size')
                .then(results => {
                    users = results.reduce((prev, val) => prev + val, 0).toLocaleString();
                })
                .catch(console.error);
        } else {
            users = client.users.size.toLocaleString();
            channels = client.channels.size.toLocaleString();
        }

        await message.channel.send(message.language.get('COMMAND_STATS_OUTPUT', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
            Math.round(require("os").loadavg()[0] * 10000) / 100,
            duration,
            users,
            guilds,
            channels,
            (client.shard ? client.shard.id : 0), 
            Object.keys(client.languages).length,
            playerCount,
            guildCount,
            languageCount,
            lastUpdated
        ), {
            code: "asciidoc"
        });
    }
}

module.exports = Stats;
