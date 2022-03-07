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

export interface ScheduledEvent {
    guildID: string,
    announceMessage: string,
    chan: string,
    guildConf: GuildConf
}

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

export interface Poll {
    question: string,
    options: string[],
    votes: {[key: string]: number},
    anon: boolean
}
