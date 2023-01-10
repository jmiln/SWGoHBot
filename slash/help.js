const Command = require("../base/slashCommand");

class Help extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "help",
            guildOnly: false,
            description: "Displays a list of the available commands."
        });
    }

    async run(Bot, interaction) {
        const fields = [];
        const helpList = Bot.help;
        for (const cat of Object.keys(helpList)) {
            const thisCat = helpList[cat];
            const outArr = [`__${thisCat.description}__`];
            const catCmd = Object.keys(thisCat.commands);
            const nameLen = Math.max(...catCmd.map(com => com.length));

            for (const cmd of catCmd) {
                outArr.push(`\`${cmd}${" ".repeat(nameLen - cmd.length)}\`| ${thisCat.commands[cmd].desc}`);
            }

            const chunks = Bot.msgArray(outArr, "\n", 1000);
            for (const [ix, chunk] of chunks.entries()) {
                fields.push({
                    name: ix > 0 ? "-" : cat.toUpperCase(),
                    value: chunk
                });
            }
        }

        return interaction.reply({embeds: [{
            fields: fields,
            color: Math.floor(Math.random()*16777215)
        }]});
    }
}

module.exports = Help;
