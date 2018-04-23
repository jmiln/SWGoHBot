var moment = require('moment-timezone');
const Command = require('../base/Command');

class Activites extends Command {
    constructor(client) {
        super(client, {
            name: "activities",
            category: "Star Wars",
            aliases: ['act']
        });
    }

    run(client, message, args) {
        const guildConf = message.guildSettings;
        
        let day = '';

        if (!args[0]) {
            if (!guildConf['timezone']) {
                day = moment().format('ddd').toProperCase();
            } else {
                day = moment().tz(guildConf['timezone']).format('ddd').toProperCase();
            }
        } else {
            day = String(args[0]).toProperCase();
        }

        switch (day) {
            case message.language.getDay('SUNDAY', 'SHORT'): case message.language.getDay('SUNDAY', 'LONG'): case 'Sun':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_SUNDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('MONDAY', 'SHORT'): case message.language.getDay('MONDAY', 'LONG'): case 'Mon':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_MONDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('TUESDAY', 'SHORT'): case message.language.getDay('TUESDAY', 'LONG'): case 'Tue':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_TUESDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('WEDNESDAY', 'SHORT'): case message.language.getDay('WEDNESDAY', 'LONG'): case 'Wed':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_WEDNESDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('THURSDAY', 'SHORT'): case message.language.getDay('THURSDAY', 'LONG'): case 'Thu':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_THURSDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('FRIDAY', 'SHORT'): case message.language.getDay('FRIDAY', 'LONG'): case 'Fri':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_FRIDAY'), {code:'asciidoc'});
                break;
            case message.language.getDay('SATURDAY', 'SHORT'): case message.language.getDay('SATURDAY', 'LONG'): case 'Sat':
                message.channel.send(message.language.get('COMMAND_ACTIVITIES_SATURDAY'), {code:'asciidoc'});
                break;
            default:
                return client.helpOut(message, this);
        }
    }
}
module.exports = Activites;
