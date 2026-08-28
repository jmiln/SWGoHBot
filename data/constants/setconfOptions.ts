import { ApplicationCommandOptionType } from "discord.js";
import { BOT_LANGUAGES, type GuildConfigSettings, SWGOH_LANGUAGES } from "../../schemas/guildConfigs.schema.ts";

interface SetconfOption {
    type: ApplicationCommandOptionType;
    description: string;
    choices?: readonly string[];
    isArray?: boolean;
}

// How each guild setting is presented as a /setconf option. The default values themselves live
// with the schema in schemas/guildConfigs.schema.ts; this file is the discord-facing half.
//
// The Record key type is the sync guarantee: adding a setting to GuildConfigSettingsSchema
// without adding it here is a compile error rather than a silently missing slash command option.
export const setconfOptions: Record<keyof GuildConfigSettings, SetconfOption> = {
    // Removed the prefix now that it should all be slash commands
    adminRole: {
        type: ApplicationCommandOptionType.Role,
        isArray: true,
        description: "A list of the roles that are allowed to mess with settings/ events.",
    },
    enableWelcome: {
        type: ApplicationCommandOptionType.Boolean,
        description: "Toggle the welcome message",
    },
    welcomeMessage: {
        type: ApplicationCommandOptionType.String,
        description: "Set the welcome message text",
    },
    enablePart: {
        type: ApplicationCommandOptionType.Boolean,
        description: "Toggle the parting/ leaving message",
    },
    partMessage: {
        type: ApplicationCommandOptionType.String,
        description: "Set the part message text",
    },
    timezone: {
        type: ApplicationCommandOptionType.String,
        description: "Set the timezone to be referenced for events and such in the guild",
    },
    announceChan: {
        type: ApplicationCommandOptionType.Channel,
        description: "Set the default channel for events to announce to",
    },
    useEventPages: {
        type: ApplicationCommandOptionType.Boolean,
        description: "Set it to show your events list in pages",
    },
    eventCountdown: {
        type: ApplicationCommandOptionType.Integer,
        isArray: true,
        description: "Set how long before events it should warn you.",
    },
    language: {
        type: ApplicationCommandOptionType.String,
        description: "Change the language (Limited options outside of English)",
        choices: BOT_LANGUAGES,
    },
    swgohLanguage: {
        type: ApplicationCommandOptionType.String,
        choices: SWGOH_LANGUAGES,
        description: "Change the language of the data from in-game",
    },
    shardtimeVertical: {
        type: ApplicationCommandOptionType.Boolean,
        description: "Display the shardtimes info vertically",
    },
};
