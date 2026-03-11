import type { ChatInputCommandInteraction, Client, Guild, GuildMember, InteractionReplyOptions, User } from "discord.js";
import Language from "../../base/Language.ts";
import type { SWAPILang } from "../../types/swapi_types.ts";
import type { CommandContext } from "../../types/types.ts";

interface MockInteractionOptions {
    optionsData?: Record<string, any>;
    guild?: Guild | null;
    user?: User;
    member?: GuildMember;
    client?: Client<true>;
}

/**
 * Creates a mock Discord ChatInputCommandInteraction for testing.
 * This is a plain Discord interaction with no bot-specific extensions.
 *
 * @param overrides - Partial interaction properties and optionsData for command options
 * @returns Mock ChatInputCommandInteraction with state tracking
 *
 * @example
 * const interaction = createMockInteraction({
 *   optionsData: { character: "vader", limit: 10 }
 * });
 */
export function createMockInteraction(
    overrides: MockInteractionOptions & Record<string, any> = {}
): ChatInputCommandInteraction {
    // State tracking
    let _deferred = false;
    let _replied = false;
    const _replies: any[] = [];

    // Options data storage
    const optionsData = new Map<string, any>(
        Object.entries(overrides.optionsData || {})
    );

    const interaction: any = {
        user: overrides.user || {
            id: "123456789",
            username: "TestUser",
            discriminator: "0000",
            bot: false,
            avatar: null,
        } as unknown as User,
        guild: overrides.guild !== undefined ? overrides.guild : {
            id: "987654321",
            name: "Test Guild",
        } as unknown as Guild,
        member: overrides.member || {
            id: "123456789",
            roles: { cache: new Map() },
        } as unknown as GuildMember,
        client: overrides.client || {
            user: { id: "bot123", username: "BotUser" },
            shard: null,
            guilds: {
                cache: { size: 1500 }
            },
            users: {
                cache: { size: 50000 }
            },
        } as unknown as Client<true>,
        channelId: overrides.channelId || "123",
        commandName: overrides.commandName || "test",
        createdTimestamp: overrides.createdTimestamp || Date.now(),
        get deferred() {
            return _deferred;
        },
        get replied() {
            return _replied;
        },
        options: {
            getString: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? String(val) : null;
            },
            getInteger: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? Number(val) : null;
            },
            getBoolean: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? Boolean(val) : null;
            },
            getSubcommand: (required?: boolean) => {
                const val = optionsData.get("_subcommand");
                if (required && val === undefined) {
                    throw new Error("Required subcommand missing");
                }
                return val !== undefined ? String(val) : null;
            },
            getSubcommandGroup: (required?: boolean) => {
                const val = optionsData.get("_subcommandGroup");
                if (required && val === undefined) {
                    throw new Error("Required subcommand group missing");
                }
                return val !== undefined ? String(val) : null;
            },
            getUser: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? val : null;
            },
            getChannel: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? val : null;
            },
            getRole: (name: string, required?: boolean) => {
                const val = optionsData.get(name);
                if (required && val === undefined) {
                    throw new Error(`Required option ${name} missing`);
                }
                return val !== undefined ? val : null;
            },
            data: optionsData,
        } as any,
        deferReply: async (options?: any) => {
            _deferred = true;
            return {} as any;
        },
        reply: async (data: InteractionReplyOptions | string) => {
            _replied = true;
            _replies.push(data);
            return {} as any;
        },
        editReply: async (data: any) => {
            if (!_replied && !_deferred) {
                throw new Error("Cannot edit reply before replying or deferring");
            }
            if (_replies.length > 0) {
                _replies[_replies.length - 1] = data;
            } else {
                _replies.push(data);
            }
            return {} as any;
        },
        followUp: async (data: InteractionReplyOptions | string) => {
            if (!_replied) {
                throw new Error("Cannot follow up before replying");
            }
            _replies.push(data);
            return {} as any;
        },
        deleteReply: async () => {
            _replies.pop();
        },
        _getReplies: () => _replies,
    };

    // Apply any additional overrides (excluding the special optionsData)
    const { optionsData: _, ...restOverrides } = overrides;
    Object.assign(interaction, restOverrides);

    return interaction as ChatInputCommandInteraction;
}

/**
 * Mock Language object for testing.
 * Provides get() and getDay() methods that match the Language class interface.
 */
/**
 * Mock Language class for testing.
 * Extends the real Language class to ensure instanceof checks work.
 */
class MockLanguage extends Language {
    constructor() {
        super();
        // Initialize required properties
        this.language = {};
        this.DAYSOFWEEK = {};
        this.TIMES = {
            DAY:    { PLURAL: "days",    SING: "day",    SHORT_PLURAL: "ds",   SHORT_SING: "d"   },
            HOUR:   { PLURAL: "hours",   SING: "hour",   SHORT_PLURAL: "hrs",  SHORT_SING: "hr"  },
            MINUTE: { PLURAL: "minutes", SING: "minute", SHORT_PLURAL: "mins", SHORT_SING: "min" },
            SECOND: { PLURAL: "seconds", SING: "second", SHORT_PLURAL: "secs", SHORT_SING: "sec" },
        };
    }

    override get(key: string, ...args: any[]): any {
        // Check for object returns first
        if (key === "COMMAND_INFO_OUTPUT") {
            return {
                statHeader: "Stats",
                users: "Users",
                servers: "Servers",
                nodeVer: "Node Version",
                discordVer: "Discord.js Version",
                swgohHeader: "SWGoH Data",
                players: "Players",
                guilds: "Guilds",
                lang: "Languages",
                links: {
                    "Support Server": "https://discord.gg/example",
                    "Invite Link": "https://discord.com/api/oauth2/authorize?client_id=example",
                },
                shardHeader: "Bot Info (Shard {{0}})",
                header: "Bot Info",
            };
        }

        // Mod stat names (unitStat ID → display name)
        if (key === "BASE_MODS_FROM_GAME") {
            return {
                1: "Health", 5: "+Speed", 16: "Critical Damage %",
                17: "Potency %", 18: "Tenacity %", 28: "Protection",
                41: "+Offense", 42: "Offense %", 48: "Defense",
                49: "Defense %", 52: "Accuracy %", 53: "Critical Avoidance %",
                55: "Speed",
            };
        }

        // Mod set names (set ID → display name)
        if (key === "BASE_MODSETS_FROM_GAME") {
            return { 1: "Health", 2: "Offense", 3: "Defense", 4: "Speed", 5: "Critical Chance", 6: "Critical Damage", 7: "Potency", 8: "Tenacity" };
        }

        // Handle guild-specific keys with parameters
        if (key === "COMMAND_GUILDS_STAT_STRINGS" && args.length >= 5) {
            // Args: memberCount, required, totalGP, charGP, shipGP
            return `Members: ${args[0]}${args[1] ? `/${args[1]}` : ""}\nGP: ${args[2]}\nChar GP: ${args[3]}\nShip GP: ${args[4]}`;
        }

        if (key === "COMMAND_GUILDS_USERS_IN_GUILD" && args.length >= 2) {
            // Args: userCount, guildName
            return `${args[0]} Users in ${args[1]}`;
        }

        if (key === "COMMAND_GUILDSEARCH_MODS_HEADER" && args.length >= 1) {
            // Args: guildName
            return `${args[0]} Mods`;
        }

        // Template replacement - numeric {{0}}, {{1}}
        let result = key;
        for (let i = 0; i < args.length; i++) {
            result = result.replace(new RegExp(`\\{\\{${i}\\}\\}`, "g"), String(args[i]));
        }

        // Named placeholders {{user}}, {{count}} if args[0] is object
        if (args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
            for (const [k, v] of Object.entries(args[0])) {
                result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
            }
        }

        return result;
    }

    getDay(day: string, format: string): string {
        const days: Record<string, string> = {
            sun: "Sunday",
            mon: "Monday",
            tue: "Tuesday",
            wed: "Wednesday",
            thu: "Thursday",
            fri: "Friday",
            sat: "Saturday",
        };
        return format === "short" ? day.slice(0, 3).toUpperCase() : days[day.toLowerCase()] || day;
    }
}

export function createMockLanguage(): Language {
    return new MockLanguage();
}

/**
 * Mock guild settings for testing.
 * Returns default guild settings with optional overrides.
 */
export function createMockGuildSettings(overrides: Record<string, any> = {}) {
    return {
        swgohLanguage: "eng_us",
        language: "eng_us",
        timezone: "America/Los_Angeles",
        announceChan: "",
        ...overrides,
    };
}

/**
 * Creates a CommandContext for testing.
 * This is the object that gets passed to command.run() methods.
 *
 * @param options - Context options
 * @returns CommandContext ready to pass to command.run()
 *
 * @example
 * const interaction = createMockInteraction({ optionsData: { character: "vader" } });
 * const ctx = createCommandContext({ interaction });
 * await command.run(ctx);
 *
 * @example
 * // With custom language and settings
 * const ctx = createCommandContext({
 *   interaction,
 *   swgohLanguage: "eng_us",
 *   guildSettings: { timezone: "Europe/London" }
 * });
 */
export function createCommandContext(options: {
    interaction: ChatInputCommandInteraction;
    language?: any;
    swgohLanguage?: SWAPILang;
    guildSettings?: any;
    permLevel?: number;
}): CommandContext {
    return {
        interaction: options.interaction,
        language: options.language || createMockLanguage(),
        swgohLanguage: options.swgohLanguage || ("eng_us" as SWAPILang),
        guildSettings: options.guildSettings || createMockGuildSettings(),
        permLevel: options.permLevel || 0,
    };
}
