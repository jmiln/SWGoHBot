import {
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    codeBlock,
    EmbedBuilder,
    type InteractionContextType,
    MessageFlags,
} from "discord.js";
import constants from "../data/constants/constants.ts";
import logger from "../modules/Logger.ts";
import type { SlashEmbedOptions } from "../types/base_types.ts";
import type { CommandContext } from "../types/types.ts";

const defCmdData = {
    name: "",
    description: "No description provided.",
    options: [],
    defaultPermissions: true,
    guildOnly: false, // false = global, true = dev_server only
    enabled: true,
    permLevel: 0,
    contexts: undefined as InteractionContextType[] | undefined,
    category: "General",
    usage: [],
};

export type CommandMetadata = typeof defCmdData;

export default abstract class slashCommand {
    // Commands must implement this with destructured parameters
    // Using any for return type to allow commands to return InteractionResponse or void
    // biome-ignore lint/suspicious/noExplicitAny: allow flexible return types
    abstract run(context: CommandContext): Promise<any>;

    commandData: CommandMetadata;
    guildOnly: boolean;

    async autocomplete?(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption): Promise<void>;

    constructor(commandData: Partial<CommandMetadata> = {}) {
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

    async embed(interactionOrContext: ChatInputCommandInteraction | CommandContext, msgIn: string, options: SlashEmbedOptions = {}) {
        // Extract interaction from context if needed
        const interaction = "interaction" in interactionOrContext ? interactionOrContext.interaction : interactionOrContext;

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
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error(`[base/slashCommand Error: ${this.commandData.name}] ${errorMessage}`);

            // Try to send error response to user if interaction hasn't been replied to
            if (!interaction.replied && !interaction.deferred) {
                await interaction
                    .reply({
                        content: "An error occurred while processing your command. Please try again later.",
                        ephemeral: true,
                    })
                    .catch((replyErr: unknown) => {
                        const replyErrMsg = replyErr instanceof Error ? replyErr.message : String(replyErr);
                        logger.error(`[base/slashCommand ${this.commandData.name}] Failed to send error reply: ${replyErrMsg}`);
                    });
            }
        }
    }
}
