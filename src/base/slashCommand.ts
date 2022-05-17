import { SlashCommandBuilder } from "@discordjs/builders";
import { BotInteraction, BotType, CommandOptions } from "../modules/types";

abstract class slashCommand {
    Bot: BotType;
    abstract run(Bot: BotType, interaction: BotInteraction, options: CommandOptions): void;
    commandData: {
        name: string,
        description: string,
        permLevel: number,
        options?: {}
    };
    enabled: boolean;
    guildOnly: boolean;
    constructor(Bot: BotType, {
        name = "null",
        description = "No description provided.",
        options = null,
        permissions = [],
        category = "",
        guildOnly = true,// false = global, true = guild.
        enabled = true,
        permLevel = 0
    }) {
        this.Bot = Bot;
        this.commandData = { name, description, permLevel };
        if (options) {
            this.commandData.options = options;
        }
        this.enabled = enabled;
        this.guildOnly = guildOnly;
    }

    async getUser(interaction: BotInteraction, userID: string, useAuth=false) {
        let out = null;
        if (useAuth && (!userID || (userID !== "me" && !this.Bot.isAllyCode(userID) && !this.Bot.isUserID(userID)))) {
            // No valid user, so use the message's author as the user
            userID = interaction.user.id;
        }
        if (userID) {
            // If it got this far, it's got a valid userID (ally code or Discord ID)
            // so regardless of which, grab an ally code
            const allyCode = await this.Bot.getAllyCode(interaction, userID);
            if (allyCode) {
                out = allyCode[0];
            }
        }

        return out;
    }

    async error(interaction: BotInteraction, err: string, options?: {[key: string]: any}) {
        if (!interaction || !interaction.channel) throw new Error(`[${this.commandData.name}] Missing message`);
        if (!err) throw new Error(`[${this.commandData.name}] Missing error message`);
        if (!options) options = {};
        options.title = options.title || "Error";
        options.color = options.color || "#e01414";
        if (options.example) {
            const prefix = interaction.guildSettings ? interaction.guildSettings.prefix : ";";
            err += `\n\n**Example:**${this.Bot.codeBlock(prefix + options.example)}`;
        }
        await this.embed(interaction, err, options);
    }

    async success(interaction: BotInteraction, out: string, options?: {[key: string]: any}) {
        if (!interaction || !interaction.channel) throw new Error("Missing message");
        if (!out) throw new Error("Missing outgoing success message");
        if (!options) options = {};
        options.title = options.title || "Success!";
        options.color = options.color || "#00ff00";
        await this.embed(interaction, out, options);
    }

    async embed(interaction: BotInteraction, out: string, options?: {[key: string]: any}) {
        if (!interaction || !interaction.channel) throw new Error("Missing interaction");
        if (!out) throw new Error("Missing outgoing message");
        if (!options) options = {};
        const title = options.title || "TITLE HERE";
        const footer = options.footer || "";
        const color = options.color;
        const ephemeral = options.ephemeral || false;
        if (interaction.replied || interaction.deferred) {
            try {
                return interaction.editReply({
                    content: null,
                    embeds: [{
                        author: {
                            name: options.title,
                            icon_url: options.iconURL || null
                        },
                        description: out.toString().length >= 1900 ? out.toString().substring(0, 1900) + "..." : out.toString(),
                        color: color,
                        footer: {
                            text: footer
                        }
                    }],
                });
            } catch (e) {
                console.log("base/slashCommand Error: " + e.message);
                console.log("base/slashCommand Message: " + interaction.options);
                return interaction.reply({
                    content: null,
                    embeds: [{
                        author: {
                            name: title,
                            icon_url: options.iconURL || null
                        },
                        description: out,
                        color: color,
                        footer: {
                            text: footer
                        }
                    }],
                    ephemeral: ephemeral
                });
            }
        } else {
            return interaction.reply({
                embeds: [{
                    author: {
                        name: title,
                        icon_url: options.iconURL || null
                    },
                    description: out,
                    color: color,
                    footer: {
                        text: footer
                    }
                }],
                ephemeral: ephemeral
            });
        }
    }
}

export default slashCommand;
