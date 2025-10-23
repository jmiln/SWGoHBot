import type { InteractionReplyOptions } from "discord.js";
import type {BotInteraction} from "../../types/types.ts";

export function createMockInteraction(overrides: Partial<BotInteraction> = {}): BotInteraction {
    const interaction: BotInteraction = {
        options: { getString: () => "" } as any,
        reply: async (_data: InteractionReplyOptions | string): Promise<void> => {},
        language: { get: (key: string) => key },
        guildSettings: {
            aliases: []
        },

        // Base Discord bits
        channel: "123",

        ...overrides,
    } as any;
    return interaction;
}
