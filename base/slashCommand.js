class slashCommand {

    constructor(Bot, {
        name = "null",
        description = "No description provided.",
        options = [],
        defaultPermissions = true,
        guildOnly = true,// false = global, true = guild.
        enabled = true,
        permLevel = 0,
        aliases = []
    }) {
        this.Bot = Bot;
        this.commandData = { name, description, options, defaultPermissions, enabled, permLevel, aliases };
        this.guildOnly = guildOnly;
    }

    async error(interaction, err, options) {
        if (!interaction || !interaction.channel) throw new Error(`[${this.name}] Missing message`);
        if (!err) throw new Error(`[${this.name}] Missing error message`);
        if (!options) options = {};
        options.title = options.title || "Error";
        options.color = options.color || "#e01414";
        if (options.example) {
            const prefix = interaction.guildSettings ? interaction.guildSettings.prefix : ";";
            err += `\n\n**Example:**${this.Bot.codeBlock(prefix + options.example)}`;
        }
        await this.embed(interaction, err, options);
    }

    async success(interaction, out, options) {
        if (!interaction || !interaction.channel) throw new Error("Missing message");
        if (!out) throw new Error("Missing outgoing success message");
        if (!options) options = {};
        options.title = options.title || "Success!";
        options.color = options.color || "#00ff00";
        await this.embed(interaction, out, options);
    }

    async embed(interaction, out, options) {
        if (!interaction || !interaction.channel) throw new Error("Missing interaction");
        if (!out) throw new Error("Missing outgoing message");
        if (!options) options = {};
        const title = options.title || "TITLE HERE";
        const footer = options.footer || "";
        const color = options.color;
        if (interaction.replied || interaction.deferred) {
            try {
                return interaction.editReply({embeds: [{
                    author: {
                        name: title,
                        icon_url: options.iconURL || null
                    },
                    description: out,
                    color: color,
                    footer: {
                        text: footer
                    }
                }]});
            } catch (e) {
                console.log("base/slashCommand Error: " + e.message);
                console.log("base/slashCommand Message: " + interaction.content);
                return interaction.channel.send({embeds: [{
                    author: {
                        name: title,
                        icon_url: options.iconURL || null
                    },
                    description: out,
                    color: color,
                    footer: {
                        text: footer
                    }
                }]});
            }
        } else {
            return interaction.reply({embeds: [{
                author: {
                    name: title,
                    icon_url: options.iconURL || null
                },
                description: out,
                color: color,
                footer: {
                    text: footer
                }
            }]});
        }
    }
}

module.exports = slashCommand;
