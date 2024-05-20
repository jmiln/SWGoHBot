const { codeBlock } = require("discord.js");

const defCmdData = {
    name: "",
    description: "No description provided.",
    options: [],
    defaultPermissions: true,
    guildOnly: true, // false = global, true = guild.
    enabled: true,
    permLevel: 0,
};
class slashCommand {
    constructor(Bot, commandData = {}) {
        this.Bot = Bot;
        this.commandData = {
            ...defCmdData,
            ...commandData,
        };
        this.guildOnly = this.commandData.guildOnly;
    }

    async getUser(interaction, userID, useAuth = false) {
        let id = null;
        if (useAuth && (!userID || (userID !== "me" && !this.Bot.isAllyCode(userID) && !this.Bot.isUserID(userID)))) {
            // No valid user, so use the message's author as the user
            id = interaction.author.id;
        }

        // If it still somehow doesn't have a valid userID, return null
        if (!id) return null;

        // If it got this far, it's got a valid userID (ally code or Discord ID)
        // so regardless of which, grab an ally code
        const allyCodes = await this.Bot.getAllyCode(interaction, id);
        if (allyCodes?.length) {
            return allyCodes[0] || null;
        }
    }

    async error(interaction, errMsg, options = { ephemeral: true }) {
        let msgOut = errMsg || null;
        if (!interaction?.channel) return console.error(`[baseSlash/error:${this.commandData.name}] Missing interaction (${interaction})`);
        if (!errMsg?.length) {
            console.error(`[baseSlash/error:${this.commandData.name}] Missing error message`);
            msgOut = "Something broke, please try again in a bit, or report it.";
        }
        if (msgOut?.includes("DiscordAPIError") && msgOut.includes("Unknown Message")) {
            return;
        }

        options.title = options.title || "Error";
        options.color = options.color || this.Bot.constants.colors.red;
        if (options.example) {
            msgOut += `\n\n**Example:**${codeBlock(options.example)}`;
        }
        await this.embed(interaction, msgOut, options);
    }

    async success(interaction, msgOut, options = {}) {
        if (!interaction?.channel) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing interaction`);
        if (!msgOut) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing outgoing success message`);
        options.title = options.title || "Success!";
        options.color = options.color || this.Bot.constants.colors.green;
        await this.embed(interaction, msgOut, options);
    }

    async embed(interaction, msgIn, options = {}) {
        let msgOut = msgIn || null;
        if (!interaction?.channel) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing interaction`);
        if (!msgIn) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing outgoing message`);
        if (msgIn?.length > 1900) msgOut = `${msgIn.toString().substring(0, 1900)}...`;

        const title = options.title || "TITLE HERE";
        const color = options.color;
        const ephemeral = options.ephemeral || false;

        // If the footer is just a string, put it in the proper object format.
        let footer = options.footer || "";
        if (typeof footer === "string") {
            footer = { text: footer };
        }

        const embedObj = {
            content: null,
            embeds: [
                {
                    author: {
                        name: title,
                        icon_url: options.iconURL || null,
                    },
                    description: msgOut,
                    color: color,
                    footer: footer,
                },
            ],
            ephemeral: ephemeral,
        };

        // If the interaction has been replied to or deferred, edit the reply
        if (interaction.replied || interaction.deferred) {
            try {
                return interaction.editReply(embedObj);
            } catch (e) {
                // If something breaks with the editReply, log it, then just send a message to that channel
                console.log(`[base/slashCommand Error: ${this.commandData.name}] ${e.message}`);
                console.log(`[base/slashCommand Message: ${this.commandData.name}] ${interaction?.content}`);
                return interaction.channel.send(embedObj);
            }
        }

        // Otherwise, just reply
        return interaction.reply(embedObj);
    }
}

module.exports = slashCommand;
