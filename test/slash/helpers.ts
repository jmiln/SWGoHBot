/**
 * Test helper functions for slash command tests
 */

import assert from "node:assert";

/**
 * Assert that the last reply was an error (ephemeral with embed)
 */
export function assertErrorReply(interaction: any, expectedMessage?: string): void {
    const replies = interaction._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");

    const lastReply = replies[replies.length - 1];
    assert.ok(lastReply.embeds, "Expected error to have embeds");
    assert.ok(lastReply.embeds.length > 0, "Expected at least one embed");
    assert.ok(lastReply.flags, "Expected error to be ephemeral");

    if (expectedMessage) {
        const embed = lastReply.embeds[0];
        const embedData = embed.data || embed;
        const description = embedData.description || "";
        assert.ok(
            description.includes(expectedMessage),
            `Expected error message to include "${expectedMessage}", got: ${description}`,
        );
    }
}

/**
 * Assert that exactly N replies were sent
 */
export function assertReplyCount(interaction: any, expectedCount: number): void {
    const replies = interaction._getReplies();
    assert.strictEqual(replies.length, expectedCount, `Expected ${expectedCount} replies, got ${replies.length}`);
}

/**
 * Get the last reply from an interaction
 */
export function getLastReply(interaction: any): any {
    const replies = interaction._getReplies();
    assert.ok(replies.length > 0, "Expected at least one reply");
    return replies[replies.length - 1];
}

/**
 * Assert that an embed has a specific field
 */
export function assertEmbedField(interaction: any, fieldName: string, expectedValue?: string): void {
    const reply = getLastReply(interaction);
    assert.ok(reply.embeds, "Expected reply to have embeds");
    assert.ok(reply.embeds.length > 0, "Expected at least one embed");

    const embed = reply.embeds[0];
    const embedData = embed.data || embed;
    assert.ok(embedData.fields, "Expected embed to have fields");

    const field = embedData.fields.find((f: any) => f.name === fieldName);
    assert.ok(field, `Expected embed to have field "${fieldName}"`);

    if (expectedValue !== undefined) {
        assert.ok(
            field.value.includes(expectedValue),
            `Expected field "${fieldName}" to include "${expectedValue}", got: ${field.value}`,
        );
    }
}
