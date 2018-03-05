const Command = require('../base/Command');

class Nickname extends Command {
    constructor(client) {
        super(client, {
            name: 'nickname',
            aliases: ['nick'],
            guildOnly: true,
            permLevel: 3,
            category: 'Admin',
            description: 'Changes the bot\'s nickname on the server',
            usage: 'nickname <name>',
            example: `;nickname swgohBot`,
            extended: `\`\`\`asciidoc
name    :: The name you're wanting to change it to. Leave it blank to reset it to default.
            \`\`\``
        });
    }

    run(client, message, args) {
        try {
            if (message.channel.permissionsFor(message.guild.me).has(["MANAGE_NICKNAMES"])) {
                if (args.length > 0) {
                    const  name = String(args.join(' '));
                    message.guild.member(client.user).setNickname(name);
                } else {
                    message.guild.member(client.user).setNickname("");
                }
                message.channel.send(message.language.COMMAND_NICKNAME_SUCCESS);
            } else {
                message.channel.send(message.language.COMMAND_NICKNAME_FAILURE);
            }
        } catch (e) {
            client.log('Broke', 'I broke while trying to set a nickname');
        }
    }
}

module.exports = Nickname;
