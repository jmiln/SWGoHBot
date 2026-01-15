import type { InteractionReplyOptions } from "discord.js";
import type {BotInteraction} from "../../types/types.ts";

export function createMockInteraction(overrides: Partial<BotInteraction> = {}): BotInteraction {
    const interaction: BotInteraction = {
        options: { getString: () => "" } as any,
        reply: async (_data: InteractionReplyOptions | string): Promise<void> => {},
        followUp: async (_data: InteractionReplyOptions | string): Promise<void> => {},
        language: {
            get: (key: string, ...args: any[]) => {
                // Handle simple template replacements
                let result = key;
                for (let i = 0; i < args.length; i++) {
                    result = result.replace(`{{${i}}}`, args[i]);
                }
                return result;
            },
            getDay: (day: string, format: string) => day.charAt(0) + day.slice(1).toLowerCase(),
        },
        guildSettings: {
            aliases: [],
            swgohLanguage: "eng_us",
        },

        // Base Discord bits
        channel: "123",

        ...overrides,
    } as any;
    return interaction;
}
