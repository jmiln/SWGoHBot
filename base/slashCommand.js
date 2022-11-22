class slashCommand {
    constructor(Bot, {
        name = "",
        description = "No description provided.",
        options = [],
        defaultPermissions = true,
        guildOnly = true,  // false = global, true = guild.
        enabled = true,
        permLevel = 0,
        aliases = []
    }) {
        this.Bot = Bot;
        this.commandData = { name, description, options, defaultPermissions, enabled, permLevel, aliases };
        this.guildOnly = guildOnly;
    }

    async getUser(message, userID, useAuth=false) {
        let out = null;
        if (useAuth && (!userID || (userID !== "me" && !this.Bot.isAllyCode(userID) && !this.Bot.isUserID(userID)))) {
            // No valid user, so use the message's author as the user
            userID = message.author.id;
        }
        if (userID) {
            // If it got this far, it's got a valid userID (ally code or Discord ID)
            // so regardless of which, grab an ally code
            const allyCodes = await this.Bot.getAllyCode(message, userID);
            if (allyCodes && allyCodes.length) {
                out = allyCodes[0];
            }
        }

        return out;
    }

    async error(interaction, errMsg, options) {
        if (!interaction || !interaction.channel) return console.error(`[baseSlash/error:${this.commandData.name}] Missing interaction (${interaction})`);
        if (!errMsg?.length) {
            console.error(`[baseSlash/error:${this.commandData.name}] Missing error message`);
            errMsg = "Something broke, please try again in a bit, or report it.";
        }
        if (!options) options = {
            ephemeral: true
        };
        options.title = options.title || "Error";
        options.color = options.color || this.Bot.constants.colors.red;
        if (options.example) {
            errMsg += `\n\n**Example:**${this.Bot.codeBlock(options.example)}`;
        }
        await this.embed(interaction, errMsg, options);
    }

    async success(interaction, msgOut, options={}) {
        if (!interaction || !interaction.channel) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing interaction`);
        if (!msgOut) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing outgoing success message`);
        options.title = options.title || "Success!";
        options.color = options.color || this.Bot.constants.colors.green;
        await this.embed(interaction, msgOut, options);
    }

    async embed(interaction, msgOut, options={}) {
        if (!interaction || !interaction.channel) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing interaction`);
        if (!msgOut) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing outgoing message`);
        const title     = options.title || "TITLE HERE";
        const color     = options.color;
        const ephemeral = options.ephemeral || false;

        // If the footer is just a string, put it in the proper object format.
        let footer = options.footer || "";
        if (typeof footer === "string") {
            footer = {text: footer};
        }

        // If the interaction has been replied to or deferred, edit the reply
        if (interaction.replied || interaction.deferred) {
            try {
                return interaction.editReply({
                    content: null,
                    embeds: [{
                        author: {
                            name: title,
                            icon_url: options.iconURL || null
                        },
                        description: msgOut.toString().substring(0, 1900) + "...",
                        color: color,
                        footer: footer
                    }],
                    ephemeral: ephemeral
                });
            } catch (e) {
                // If something breaks with the editReply, log it, then just send a message to that channel
                console.log(`[base/slashCommand Error: ${this.commandData.name}] ` + e.message);
                console.log(`[base/slashCommand Message: ${this.commandData.name}] ` + interaction.content);
                return interaction.channel.send({
                    content: null,
                    embeds: [{
                        author: {
                            name: title,
                            icon_url: options.iconURL || null
                        },
                        description: msgOut,
                        color: color,
                        footer: footer
                    }],
                    ephemeral: ephemeral
                });
            }
        }

        // Otherwise, just reply
        return interaction.reply({
            embeds: [{
                author: {
                    name: title,
                    icon_url: options.iconURL || null
                },
                description: msgOut,
                color: color,
                footer: footer
            }],
            ephemeral: ephemeral
        });
    }
}

module.exports = slashCommand;
