// The guildConf object, for per-guild setitngs
export interface GuildConf {
    prefix: string,
    adminRole: string[],
    enableWelcome: boolean,
    welcomeMessage: string,
    enablePart: boolean,
    partMessage: string,
    useEmbeds: boolean,
    timezone: string,
    announceChan: string,
    useEventPages: boolean,
    eventCountdown: Number[],
    language: string,
    swgohLanguage: string,
    shardtimeVertical: boolean,
    useActivityLog: boolean,
    changelogWebhook: string
}

// Events from the event scheduler
export interface ScheduledEvent {
    guildID: string,
    announceMessage: string,
    chan: string,
    guildConf: GuildConf
}

// The actual events that get saved
export interface SavedEvent {
    eventID: string,
    eventDT: number,
    eventMessage: string,
    eventChan: string, // Should be a Discord channel ID
    countdown: boolean,
    repeat: {[key: string]: number} | string,   // The {day,hr,min} or the 0d0h0m
    repeatDays: number[]
}

// Event sent to validate
export interface ValidateEvent {
    name: string,
    time: string,
    day: string,
    message: string,
    channelID: string
    countdown: boolean,
    repeat: string,
    repeatDay: string
}

// Character or ship objects, as stored in the json files
export interface UnitObj {
    name: string,
    uniqueName: string,
    aliases: string[],
    nameVariant: string[],
    url: string,
    avatarURL: string,
    side: string,
    factions: string[],
    mods: {},
    crew: string[] | null
}

// Poll objects
export interface Poll {
    question: string,
    options: string[],
    votes: {[key: string]: number},
    anon: boolean
}

// ArenaWatch player
export interface AWPlayer {
    allyCode: number,
    name: string,
    mention: string,
    lastChar: number | null,
    lastShip: number | null,
    poOffset: number,
    mark: string | null
}
