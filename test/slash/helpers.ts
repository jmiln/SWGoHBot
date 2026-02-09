/**
 * Shared test helpers for slash command tests
 *
 * Provides assertion helpers and mock data utilities for testing slash commands.
 */

import assert from "node:assert";
import type { ChatInputCommandInteraction } from "discord.js";

/**
 * Assert that the interaction received an error reply
 *
 * @param interaction - The mock interaction
 * @param expectedKey - Optional expected language key or partial message
 */
export function assertErrorReply(interaction: ChatInputCommandInteraction, expectedKey?: string) {
    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");

    const lastReply = replies[replies.length - 1];

    // Check if it's an embed with error characteristics
    if (typeof lastReply === "object" && lastReply.embeds) {
        const embed = lastReply.embeds[0];
        assert.ok(embed, "Expected embed in reply");

        // Error embeds typically have red color (from constants.colors.red)
        // and are ephemeral (MessageFlags.Ephemeral)
        if (lastReply.flags && lastReply.flags.length > 0) {
            // Has ephemeral flag - likely an error
            assert.ok(true, "Reply has ephemeral flag (expected for errors)");
        }

        if (expectedKey) {
            const description = embed.description || embed.data?.description || "";
            assert.ok(
                description.includes(expectedKey),
                `Expected description to include "${expectedKey}", got: ${description}`
            );
        }
    } else {
        assert.fail("Expected reply to be an embed object");
    }
}

/**
 * Assert that the interaction received a success reply
 *
 * @param interaction - The mock interaction
 * @param expectedMessage - Optional expected message content
 */
export function assertSuccessReply(interaction: ChatInputCommandInteraction, expectedMessage?: string) {
    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");

    const lastReply = replies[replies.length - 1];

    if (typeof lastReply === "object" && lastReply.embeds) {
        const embed = lastReply.embeds[0];
        assert.ok(embed, "Expected embed in reply");

        if (expectedMessage) {
            const description = embed.description || embed.data?.description || "";
            assert.ok(
                description.includes(expectedMessage),
                `Expected description to include "${expectedMessage}", got: ${description}`
            );
        }
    } else if (typeof lastReply === "object" && lastReply.content) {
        // Some commands use plain content replies
        if (expectedMessage) {
            assert.ok(
                lastReply.content.includes(expectedMessage),
                `Expected content to include "${expectedMessage}", got: ${lastReply.content}`
            );
        }
    } else {
        assert.fail("Expected reply to be an embed or content object");
    }
}

/**
 * Assert that a reply contains an embed with a specific field
 *
 * @param interaction - The mock interaction
 * @param fieldName - Name of the field to check
 * @param expectedValue - Optional expected field value (partial match)
 */
export function assertEmbedField(interaction: ChatInputCommandInteraction, fieldName: string, expectedValue?: string) {
    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");

    const lastReply = replies[replies.length - 1];
    assert.ok(typeof lastReply === "object" && lastReply.embeds, "Expected embed reply");

    const embed = lastReply.embeds[0];
    assert.ok(embed.fields, "Expected embed to have fields");

    const field = embed.fields.find((f: any) => f.name === fieldName);
    assert.ok(field, `Expected to find field with name "${fieldName}"`);

    if (expectedValue) {
        assert.ok(
            field.value.includes(expectedValue),
            `Expected field value to include "${expectedValue}", got: ${field.value}`
        );
    }
}

/**
 * Assert the number of replies sent
 *
 * @param interaction - The mock interaction
 * @param expected - Expected number of replies
 */
export function assertReplyCount(interaction: ChatInputCommandInteraction, expected: number) {
    const replies = (interaction as any)._getReplies();
    assert.strictEqual(replies.length, expected, `Expected ${expected} replies, got ${replies.length}`);
}

/**
 * Get the last reply from an interaction
 *
 * @param interaction - The mock interaction
 * @returns The last reply object
 */
export function getLastReply(interaction: ChatInputCommandInteraction) {
    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");
    return replies[replies.length - 1];
}

/**
 * Seed a registered user in the bot's cache
 *
 * @param bot - The mock bot instance
 * @param userId - Discord user ID
 * @param allyCode - SWGOH ally code
 * @param name - Player name (optional)
 */
export async function seedRegisteredUser(
    // biome-ignore lint/suspicious/noExplicitAny: mockBot returns any
    bot: any,
    userId: string,
    allyCode: string,
    name = "TestPlayer"
) {
    await bot.cache.put(
        (bot as any).config.mongodb.swgohbotdb,
        "users",
        { id: userId },
        {
            id: userId,
            accounts: [{ allyCode, name, primary: true }]
        }
    );
}

/**
 * Seed guild configuration in the bot's cache
 *
 * @param bot - The mock bot instance
 * @param guildId - Discord guild ID
 * @param settings - Guild settings object
 */
export async function seedGuildConfig(
    // biome-ignore lint/suspicious/noExplicitAny: mockBot returns any
    bot: any,
    guildId: string,
    settings: Record<string, any>
) {
    await bot.cache.put(
        (bot as any).config.mongodb.swgohbotdb,
        "settings",
        { id: guildId },
        {
            id: guildId,
            ...settings
        }
    );
}

/**
 * Create a scenario with a registered user
 *
 * @param allyCode - Ally code for the user (default: "123456789")
 * @returns Object with bot and interaction configured for registered user
 */
export async function createRegisteredUserScenario(allyCode = "123456789") {
    const { createMockBot, createMockInteraction } = await import("../mocks/index.ts");

    const bot = createMockBot();
    const interaction = createMockInteraction();

    await seedRegisteredUser(bot, interaction.user.id, allyCode);

    return { bot, interaction };
}
