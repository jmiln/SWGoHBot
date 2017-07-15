const Discord = require('discord.js');
const client = new Discord.Client();
const settings = require('./settings.json');
const chalk = require('chalk');
const fs = require('fs');
const moment = require('moment');
const PersistentCollection = require("djs-collection-persistent");
require('./util/eventLoader')(client);

const log = message => {
    console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}`);
};

client.guildSettings = new PersistentCollection({name: 'guildSettings'});

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
fs.readdir('./commands/', (err, files) => {
    if (err) console.error(err);
    log(`Loading a total of ${files.length} commands.`);
    files.forEach(f => {
        let props = require(`./commands/${f}`);
        // log(`Loading Command: ${props.help.name}. 👌`);
        client.commands.set(props.help.name, props);
        props.conf.aliases.forEach(alias => {
            client.aliases.set(alias, props.help.name);
        });
    });
});

client.reload = command => {
    return new Promise((resolve, reject) => {
        try {
            delete require.cache[require.resolve(`./commands/${command}`)];
            let cmd = require(`./commands/${command}`);
            client.commands.delete(command);
            client.aliases.forEach((cmd, alias) => {
                if (cmd === command) client.aliases.delete(alias);
            });
            client.commands.set(command, cmd);
            cmd.conf.aliases.forEach(alias => {
                client.aliases.set(alias, cmd.help.name);
            });
            resolve();
        } catch (e) {
            reject(e);
        }
    });
};

client.elevation = message => {
    /* This function should resolve to an ELEVATION level which
       is then sent to the command handler for verification*/

    const guildSettings = client.guildSettings;

    // Everyone
    let permlvl = 0;

    //  If it doesn't exist for some reason, don't let em work. (PMs maybe?)
    if(!message.guild) return permlvl;

    // Check again just in case
    if(message.guild) {
        const guildConf = guildSettings.get(message.guild.id);

        // The admin role set in each of the guilds
        let admin_role = message.guild.roles.find('name', guildConf.adminRole);
        if (admin_role && message.member.roles.has(admin_role.id)) return permlvl = 3;

        // The mod role set in each guild
        let mod_role = message.guild.roles.find('name', guildConf.modRole);
        if (mod_role && message.member.roles.has(mod_role.id)) return permlvl = 2;
    }
    // The owner of the guild is automatically an admin in that guild
    if (message.author.id === message.guild.owner.id) return permlvl = 3;

    // Me, the maker of the bot
    if (message.author.id === settings.ownerid) return permlvl = 4;

    return permlvl;
};


var regToken = /[\w\d]{24}\.[\w\d]{6}\.[\w\d-_]{27}/g;

client.on('warn', e => {
    console.log(chalk.bgYellow(e.replace(regToken, 'that was redacted')));
});

client.on('error', e => {
    console.log(chalk.bgRed(e.replace(regToken, 'that was redacted')));
});

client.login(settings.token);
