const Command = require('../base/Command');

class Challenges extends Command {
    constructor(client) {
        super(client, {
            name: 'challenges',
            category: 'Star Wars',
            aliases: ['challenge', 'chal']
        });
    }

    run(client, message, args) {
        const config = client.config;

        const challenges = {
            // Normal Challenges
            [message.language.get('COMMAND_CHALLENGES_TRAINING')]: ['Sunday', 'Monday', 'Saturday'],
            [message.language.get('COMMAND_CHALLENGES_ABILITY')] : ['Sunday', 'Wednesday', 'Saturday'],
            [message.language.get('COMMAND_CHALLENGES_BOUNTY')]  : ['Sunday', 'Tuesday', 'Friday'],
            [message.language.get('COMMAND_CHALLENGES_AGILITY')] : ['Sunday', 'Tuesday', 'Friday'],
            [message.language.get('COMMAND_CHALLENGES_STRENGTH')]: ['Sunday', 'Monday', 'Thursday'],
            [message.language.get('COMMAND_CHALLENGES_TACTICS')] : ['Sunday', 'Wednesday', 'Saturday'],
        
            // Ship Challenges
            [message.language.get('COMMAND_CHALLENGES_SHIP_ENHANCEMENT')]: ['Monday', 'Wednesday', 'Saturday'],
            [message.language.get('COMMAND_CHALLENGES_SHIP_BUILDING')]   : ['Monday', 'Tuesday', 'Friday'],
            [message.language.get('COMMAND_CHALLENGES_SHIP_ABILITY')]    : ['Monday', 'Thursday', 'Sunday']
        };

        const dayString = (day) => {
            let dayString = `== Challenges for ${message.language.getDay(day.toUpperCase(), 'LONG').toProperCase()} ==`;
            for (var challenge in challenges) {
                if (challenges[challenge].includes(day)) {
                    dayString += `\n* ${challenge}`;
                }
            }
            return dayString;
        };

        if (!args[0]) return message.channel.send(message.language.COMMAND_CHALLENGES_MISSING_DAY);
        const day = String(args[0]).toProperCase();

        switch (day) {
            case message.language.getDay('SUNDAY', 'SHORT'): case  message.language.getDay('SUNDAY', 'LONG'):
                return message.channel.send(dayString('Sunday'), {code:'asciidoc'});
            case message.language.getDay('MONDAY', 'SHORT'): case message.language.getDay('MONDAY', 'LONG'):
                return message.channel.send(dayString('Monday'), {code:'asciidoc'});
            case message.language.getDay('TUESDAY', 'SHORT'): case  message.language.getDay('TUESDAY', 'LONG'):
                return message.channel.send(dayString('Tuesday'), {code:'asciidoc'});
            case message.language.getDay('WEDNESDAY', 'SHORT'): case message.language.getDay('WEDNESDAY', 'LONG'):
                return message.channel.send(dayString('Wednesday'), {code:'asciidoc'});
            case message.language.getDay('THURSDAY', 'SHORT'): case message.language.getDay('THURSDAY', 'LONG'):
                return message.channel.send(dayString('Thursday'), {code:'asciidoc'});
            case message.language.getDay('FRIDAY', 'SHORT'): case message.language.getDay('FRIDAY', 'LONG'):
                return message.channel.send(dayString('Friday'), {code:'asciidoc'});
            case message.language.getDay('SATURDAY', 'SHORT'): case message.language.getDay('SATURDAY', 'LONG'):
                return message.channel.send(dayString('Saturday'), {code:'asciidoc'});
            default:
                return message.channel.send(message.language.get('COMMAND_CHALLENGES_DEFAULT', config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
        }
    }
}

module.exports = Challenges;
