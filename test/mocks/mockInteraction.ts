import type { Client, Guild, GuildMember, InteractionReplyOptions, User } from "discord.js";
import type {BotInteraction} from "../../types/types.ts";

interface MockInteractionOptions {
    optionsData?: Record<string, any>;
}

/**
 * Creates a comprehensive mock Discord interaction for testing slash commands.
 *
 * Includes realistic Discord properties (user, guild, member, client) and tracks
 * interaction state (deferred, replied). Options can be configured via optionsData.
 *
 * @param overrides - Partial BotInteraction properties and optionsData for command options
 * @returns Fully typed BotInteraction mock with state tracking
 *
 * @example
 * // Basic usage
 * const interaction = createMockInteraction();
 *
 * @example
 * // With command options
 * const interaction = createMockInteraction({
 *   optionsData: {
 *     character: "vader",
 *     limit: 10,
 *     verbose: true
 *   }
 * });
 *
 * @example
 * // Override user and test state tracking
 * const interaction = createMockInteraction({
 *   user: { id: "999", username: "CustomUser" } as any,
 *   optionsData: { search: "test" }
 * });
 * await interaction.reply("Test");
 * const replies = (interaction as any)._getReplies(); // Access test helper
 */
export function createMockInteraction(
    overrides: Partial<BotInteraction> & MockInteractionOptions = {}
): BotInteraction {
    // State tracking
    let _deferred = false;
    let _replied = false;
    const _replies: any[] = [];

    // Options data storage
    const optionsData = new Map<string, any>(
        Object.entries((overrides as any).optionsData || {})
    );

    const interaction: BotInteraction = {
        user: {
            id: "123456789",
            username: "TestUser",
            discriminator: "0000",
            bot: false,
            avatar: null,
        } as unknown as User,
        guild: {
            id: "987654321",
            name: "Test Guild",
        } as unknown as Guild,
        member: {
            id: "123456789",
            roles: { cache: new Map() },
        } as unknown as GuildMember,
        client: {
            user: { id: "bot123", username: "BotUser" },
            shard: null,
            guilds: {
                cache: { size: 1500 }
            },
            users: {
                cache: { size: 50000 }
            },
        } as unknown as Client,
        channelId: "123",
        commandName: "test",
        createdTimestamp: Date.now(),
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
            _data: optionsData,
        },
        deferReply: async (options?: any) => {
            _deferred = true;
        },
        reply: async (data: InteractionReplyOptions | string) => {
            _replied = true;
            _replies.push(data);
        },
        editReply: async (data: InteractionReplyOptions | string) => {
            if (!_replied && !_deferred) {
                throw new Error("Cannot edit reply before replying or deferring");
            }
            if (_replies.length > 0) {
                _replies[_replies.length - 1] = data;
            } else {
                _replies.push(data);
            }
            return data;
        },
        followUp: async (data: InteractionReplyOptions | string) => {
            if (!_replied) {
                throw new Error("Cannot follow up before replying");
            }
            _replies.push(data);
        },
        deleteReply: async () => {
            _replies.pop();
        },
        update: async (data: InteractionReplyOptions | string) => {
            _replied = true;
            _replies.push(data);
        },
        _getReplies: () => _replies,
        language: {
            get: (key: string, ...args: any[]) => {
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
            },
            getDay: (day: string, format: string) => {
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
            },
        },
        guildSettings: {
            aliases: [],
            swgohLanguage: "eng_us",
        },

        ...overrides,
    };
    return interaction as BotInteraction;
}
