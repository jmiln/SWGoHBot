import { type AutocompleteFocusedOption, type ChatInputCommandInteraction, codeBlock, EmbedBuilder, MessageFlags } from "discord.js";
import constants from "../data/constants/constants.ts";
import logger from "../modules/Logger.ts";
import type { SlashEmbedOptions } from "../types/base_types.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

const defCmdData = {
    name: "",
    description: "No description provided.",
    options: [],
    defaultPermissions: true,
    guildOnly: false, // false = global, true = dev_server only
    enabled: true,
    permLevel: 0,
};

export type CommandMetadata = typeof defCmdData;

export default abstract class slashCommand {
    abstract run(_Bot: BotType, _interaction: BotInteraction, _opts: { level: number });
    Bot: BotType;
    commandData: CommandMetadata;
    guildOnly: boolean;

    // Only really in setconf
    async autocomplete?(Bot: BotType, interaction: BotInteraction, focusedOption: AutocompleteFocusedOption): Promise<void>;

    constructor(Bot: BotType, commandData: Partial<CommandMetadata> = {}) {
        this.Bot = Bot;
        this.commandData = {
            ...defCmdData,
            ...commandData,
        };
        this.guildOnly = this.commandData.guildOnly;
    }

    async error(interaction: ChatInputCommandInteraction, errMsg: string, options: SlashEmbedOptions = {}): Promise<void> {
        const errorOptions = {
            ephemeral: true,
            title: "Error",
            color: constants.colors.red,
            ...options,
        };

        let msgOut = errMsg || "Something broke, please try again in a bit, or report it.";
        if (options.example) msgOut += `\n\n**Example:**${codeBlock(options.example)}`;
        await this.embed(interaction, msgOut, errorOptions);
    }

    async success(interaction: ChatInputCommandInteraction, msgOut: string, options: SlashEmbedOptions = {}) {
        const successOptions = {
            title: "Success",
            color: constants.colors.green,
            ephemeral: false,
            ...options,
        };
        await this.embed(interaction, msgOut || "Success!", successOptions);
    }

    async embed(interaction: ChatInputCommandInteraction | BotInteraction, msgIn: string, options: SlashEmbedOptions = {}) {
        const { title = "TITLE HERE", color = constants.colors.green, ephemeral = false, footer = "", iconURL = "" } = options;

        const description = msgIn?.length > 2000 ? `${msgIn.toString().substring(0, 2000)}...` : msgIn;

        const embed = new EmbedBuilder().setDescription(description).setColor(color);

        if (title || iconURL) {
            embed.setAuthor({ name: title, iconURL: iconURL || null });
        }
        if (footer?.length) {
            embed.setFooter({ text: footer });
        }

        const embedObj = {
            embeds: [embed],
            flags: [],
        };
        if (ephemeral) {
            embedObj.flags = [MessageFlags.Ephemeral];
        }

        // If the interaction has been replied to or deferred, edit the reply
        try {
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply(embedObj);
            }
            return await interaction.reply(embedObj);
        } catch (e) {
            logger.error(`[base/slashCommand Error: ${this.commandData.name}] ${e.message}`);
        }
    }
}
