const Command = require('../base/Command');

class Resources extends Command {
    constructor(client) {
        super(client, {
            name: 'resources',
            category: "Misc",
            aliases: ["res"],
            permissions: ['EMBED_LINKS'],    // Starts with ['SEND_MESSAGES', 'VIEW_CHANNEL'] so don't need to add them
            permLevel: 0
        });
    }

    async run(client, message, [...cat]) { // eslint-disable-line no-unused-vars
        const fields = [];
        const resources = client.resources;
        let categories = Object.keys(resources);
        if (!cat.length) {
            return message.channel.send(message.language.get('COMMAND_RESOURCES_INVALID_CATEGORY', categories.join(', ')));
        }
        cat = cat.join(' ');
        if (!categories.filter(c => c.toLowerCase() === cat.toLowerCase()).length) {
            return message.channel.send(message.language.get('COMMAND_RESOURCES_INVALID_CATEGORY', categories.join(', ')));
        } 
        categories = categories.filter(c => c.toLowerCase() === cat.toLowerCase());
        const category = categories[0];
        const fieldArr = [];
        Object.keys(resources[category]).forEach(res => {
            const r = resources[category][res];
            let fieldVal = `**__${res}__**\n`;
            if (Object.keys(r) && Object.keys(r).length) {
                Object.keys(r).forEach(k => {
                    if (typeof r[k] === 'string' && r[k].length > 0) {
                        if (k === 'Desc') {
                            fieldVal += r[k] + '\n';
                        } else {
                            fieldVal += `**${k}:** ${r[k]}\n`;
                        }
                    } else if (typeof r[k] === 'object' && Object.keys(r[k]).length > 0) {
                        fieldVal += `**${k}**\n`;
                        Object.keys(r[k]).forEach(name => {
                            fieldVal += ` - ${name}: ${r[k][name]}\n`;
                        });
                    }
                });
            }
            fieldArr.push(fieldVal);
        });
        const msgArr = client.msgArray(fieldArr, '\n', 1000);
        msgArr.forEach((msg, ix) => {
            fields.push({
                "name": msgArr.length > 1 ? category + ` (${ix+1}/${msgArr.length})` : category,
                "value": msg
            });
        });
        return message.channel.send({embed: {
            author: {
                name: message.language.get('COMMAND_RESOURCES_HEADER')
            },
            fields: fields
        }});
    }
}

module.exports = Resources;

