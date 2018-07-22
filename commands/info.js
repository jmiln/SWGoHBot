const Command = require('../base/Command');

class Info extends Command {
    constructor(client) {
        super(client, {
            aliases: ['invite', 'inv'],
            name: 'info',
            category: 'Misc',
            permissions: ['EMBED_LINKS']
        });
    }

    async run(client, message) {
        const guilds = await client.guildCount();
        const content = message.language.get('COMMAND_INFO_OUTPUT', guilds, message.guildSettings.prefix);
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
            fields: fields,
            color: Math.floor(Math.random()*16777215)
        }});
    }
}

module.exports = Info;
