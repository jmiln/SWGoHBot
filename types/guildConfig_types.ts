import type { BotDefaultSettings, GuildAlias } from "./types.ts";

export interface GuildConfig {
    guildId: string;
    events: GuildConfigEvent[];
    polls: GuildConfigPoll[];
    shardTimes: GuildConfigShardTimes[];
    settings: BotDefaultSettings;
    aliases: GuildAlias[];
    patreonSettings: GuildConfigPatreonSettings;
    twList: GuildConfigTWList;
}
export interface GuildConfigShardTimes {
    times: {
        [key: string]: {
            flag: string;
            type: string;
            timezone: number | string;
            zoneType: string;
        };
    };
    channelId: string;
}
export interface GuildConfigPatreonSettings {
    supporters: {
        userId: string;
        tier: number;
    }[];
}
export interface GuildConfigEvent {
    name: string;
    eventDT: number;
    message: string;
    channel: string;
    countdown: boolean;
    repeat?: {
        repeatDay: number;
        repeatMin: number;
        repeatHour: number;
    };
    repeatDays?: number[];

    // eventDT inputs that get processed
    day?: string;
    time?: string;
    repeatStr?: string; // The string that gets parsed into repeat{day/hr/min}
    repeatDay: string; // The comma separated list of days that gets parsed into repeatDays
    channelID?: string; // Deprecated field
    guildId?: string; // Used in the getAllEvents function to specify which is from where
}
export interface GuildConfigPoll {
    question: string;
    options: string[];
    votes: {
        // userId: choiceIndex
        [key: string]: number;
    };
    anon: boolean | null;
    channelId: string;
}
export interface GuildConfigTWList {
    "Light Side"?: string[];
    "Dark Side"?: string[];
    "Galactic Legends"?: string[];
    "Ships"?: string[];
    "Capital Ships"?: string[];
    "Blacklist"?: string[];
}
