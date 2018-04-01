const Command = require('../base/Command');

class Info extends Command {
    constructor(client) {
        super(client, {
            aliases: ['invite', 'inv'],
            name: 'info',
            category: 'Misc'
        });
    }

    async run(client, message) {
        let guilds = 0;
        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues('guilds.size')
                .then(results => {
                    guilds = results.reduce((prev, val) => prev + val, 0).toLocaleString();
                })
                .catch(console.error);
        } else {
            guilds = client.guilds.size.toLocaleString();
        }
        const content = message.language.COMMAND_INFO_OUTPUT(guilds);
        const fields = [];
        Object.keys(content.links).forEach(link => {
            fields.push({
                name: link,
                value: content.links[link]
            });
        });

        message.channel.send({embed: {
            author: {
                name: content.header
            },
            description: content.desc,
            fields: fields
        }});
    }
}

module.exports = Info;
