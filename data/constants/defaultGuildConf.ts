import { ApplicationCommandOptionType } from "discord.js";
import type { GuildConfigSettings, TypedDefaultSettings } from "../../types/guildConfig_types.ts";

// Default guild config settings, leave these as-is
export const typedDefaultSettings: TypedDefaultSettings = {
    // Settings in a way that the bot can parse em out into slash command args
    //
    // Removed the prefix now that it should all be slash commands
    //
    adminRole: {
        value: ["Administrator"],
        type: ApplicationCommandOptionType.Role,
        isArray: true,
        description: "A list of the roles that are allowed to mess with settings/ events.",
    },
    enableWelcome: {
        value: false,
        type: ApplicationCommandOptionType.Boolean,
        description: "Toggle the welcome message",
    },
    welcomeMessage: {
        value: "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
        type: ApplicationCommandOptionType.String,
        description: "Set the welcome message text",
    },
    enablePart: {
        value: false,
        type: ApplicationCommandOptionType.Boolean,
        description: "Toggle the parting/ leaving message",
    },
    partMessage: {
        value: "Goodbye {{user}}, thanks for stopping by!",
        type: ApplicationCommandOptionType.String,
        description: "Set the part message text",
    },
    timezone: {
        value: "America/Los_Angeles",
        type: ApplicationCommandOptionType.String,
        description: "Set the timezone to be referenced for events and such in the guild",
    },
    announceChan: {
        value: "",
        type: ApplicationCommandOptionType.Channel,
        description: "Set the default channel for events to announce to",
    },
    useEventPages: {
        value: false,
        type: ApplicationCommandOptionType.Boolean,
        description: "Set it to show your events list in pages",
    },
    eventCountdown: {
        value: [2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5],
        type: ApplicationCommandOptionType.Integer,
        isArray: true,
        description: "Set how long before events is should warn you.",
    },
    language: {
        value: "en_US",
        type: ApplicationCommandOptionType.String,
        description: "Change the language (Limited options outside of English)",
        choices: ["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"],
    },
    swgohLanguage: {
        value: "ENG_US",
        type: ApplicationCommandOptionType.String,
        choices: [
            "ENG_US",
            "GER_DE",
            "SPA_XM",
            "FRE_FR",
            "RUS_RU",
            "POR_BR",
            "KOR_KR",
            "ITA_IT",
            "TUR_TR",
            "CHS_CN",
            "CHT_CN",
            "IND_ID",
            "JPN_JP",
            "THA_TH",
        ],
        description: "Change the language of the data from in-game",
    },
    shardtimeVertical: {
        value: false,
        type: ApplicationCommandOptionType.Boolean,
        description: "Display the shardtimes info vertically",
    },
};

export const defaultSettings = getDefaultGuildConf();

function getDefaultGuildConf() {
    const defSettings: TypedDefaultSettings = typedDefaultSettings;
    const settingsOut: Partial<GuildConfigSettings> = {};
    for (const [key, conf] of Object.entries(defSettings)) {
        settingsOut[key] = conf.value;
    }
    return settingsOut as GuildConfigSettings;
};
