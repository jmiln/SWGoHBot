import { type AutocompleteFocusedOption, type ChatInputCommandInteraction, codeBlock, MessageFlags } from "discord.js";
import type { SlashEmbedOptions } from "../types/base_types.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

const defCmdData = {
    name: "",
    description: "No description provided.",
    options: [],
    defaultPermissions: true,
    guildOnly: true, // false = global, true = guild.
    enabled: true,
    permLevel: 0,
};
export default abstract class slashCommand {
    run(_Bot: BotType, _interaction: BotInteraction, _opts: { level: number }) {
        throw new Error("Method not implemented.");
    }
    Bot: BotType;
    commandData: typeof defCmdData;
    guildOnly: boolean;

    // Only really in setconf
    autocomplete?(Bot: BotType, interaction: BotInteraction, focusedOption: AutocompleteFocusedOption): Promise<void>;

    constructor(Bot: BotType, commandData = {}) {
        this.Bot = Bot;
        this.commandData = {
            ...defCmdData,
            ...commandData,
        };
        this.guildOnly = this.commandData.guildOnly;
    }

    async error(
        interaction: ChatInputCommandInteraction,
        errMsg: string,
        options: SlashEmbedOptions = {
            ephemeral: true,
            title: "Error",
            footer: "",
            color: this.Bot.constants.colors.red,
            example: "",
        },
    ): Promise<void> {
        let msgOut = errMsg || null;
        if (!interaction?.channel) {
            console.error(`[baseSlash/error:${this.commandData.name}] Missing interaction (${interaction})`);
            return;
        }
        if (!errMsg?.length) {
            console.error(`[baseSlash/error:${this.commandData.name}] Missing error message`);
            msgOut = "Something broke, please try again in a bit, or report it.";
        }
        if (msgOut?.includes("DiscordAPIError") && msgOut.includes("Unknown Message")) {
            return;
        }

        if (options.example?.length) {
            msgOut += `\n\n**Example:**${codeBlock(options.example)}`;
        }
        await this.embed(interaction, msgOut, options);
    }

    async success(
        interaction: ChatInputCommandInteraction,
        msgOut: string,
        options: SlashEmbedOptions = { title: "Success", color: this.Bot.constants.colors.green, ephemeral: false, footer: "" },
    ) {
        if (!interaction?.channel) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing interaction`);
        if (!msgOut) throw new Error(`[baseSlash/success:${this.commandData.name}] Missing outgoing success message`);
        await this.embed(interaction, msgOut, options);
    }

    async embed(
        interaction: ChatInputCommandInteraction,
        msgIn: string,
        options: SlashEmbedOptions = {
            title: "TITLE HERE",
            color: this.Bot.constants.colors.green,
            ephemeral: false,
            footer: "",
            iconURL: "",
        },
    ) {
        let msgOut = msgIn || null;
        if (!interaction?.channel) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing interaction`);
        if (!msgIn) throw new Error(`[baseSlash/embed:${this.commandData.name}] Missing outgoing message`);
        if (msgIn?.length > 1900) msgOut = `${msgIn.toString().substring(0, 1900)}...`;

        const embedObj = {
            content: null,
            embeds: [
                {
                    author: {
                        name: options.title,
                        icon_url: options.iconURL || null,
                    },
                    description: msgOut,
                    color: options.color,
                    footer: options?.footer ? { text: options.footer } : null,
                },
            ],
        };

        // If the interaction has been replied to or deferred, edit the reply
        if (interaction.replied || interaction.deferred) {
            try {
                return interaction.editReply(embedObj);
            } catch (e) {
                // If something breaks with the editReply, log it, then just send a message to that channel
                console.log(`[base/slashCommand Error: ${this.commandData.name}] ${e.message}`);
                return interaction.channel.send(embedObj);
            }
        }

        // Otherwise, just reply
        return interaction.reply({
            ...embedObj,

            // Can only set it to be ephemeral if it hasn't been deferred or replied to already
            flags: options?.ephemeral ? MessageFlags.Ephemeral : null,
        });
    }
}
