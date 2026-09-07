import assert from "node:assert";
import { describe, it } from "node:test";
import {
    type EmbedField,
    MAX_CHARS_PER_MESSAGE,
    MAX_EMBEDS_PER_MESSAGE,
    MAX_FIELDS_PER_EMBED,
    paginateEmbedFields,
} from "../../../modules/utils/embeds.ts";

function field(name: string, valueLength: number): EmbedField {
    return { name, value: "x".repeat(valueLength) };
}

function messageChars(embeds: EmbedField[][]): number {
    return embeds.flat().reduce((sum, f) => sum + f.name.length + f.value.length, 0);
}

describe("paginateEmbedFields", () => {
    it("keeps a small set in a single message and embed", () => {
        const messages = paginateEmbedFields([field("a", 10), field("b", 10)]);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].length, 1);
        assert.deepStrictEqual(
            messages[0][0].map((f) => f.name),
            ["a", "b"],
        );
    });

    it("returns one empty embed for no fields so callers always have somewhere to put a title", () => {
        assert.deepStrictEqual(paginateEmbedFields([]), [[[]]]);
    });

    it("splits into a new message before any message exceeds Discord's total character cap", () => {
        // Six 1084-char fields is 6504 chars: the exact /mydatacrons shape that prod rejects.
        const fields = Array.from({ length: 6 }, (_, i) => field(`dc${i}`.padEnd(60, "."), 1024));
        const messages = paginateEmbedFields(fields);

        assert.ok(messages.length > 1, "expected the oversized set to span more than one message");
        for (const embeds of messages) {
            assert.ok(
                messageChars(embeds) <= MAX_CHARS_PER_MESSAGE,
                `message held ${messageChars(embeds)} chars, over the ${MAX_CHARS_PER_MESSAGE} cap`,
            );
        }
    });

    it("drops nothing, preserving every field in order across messages", () => {
        const fields = Array.from({ length: 43 }, (_, i) => field(`f${i}`, 300));
        const messages = paginateEmbedFields(fields);
        const flattened = messages.flat(2);

        assert.strictEqual(flattened.length, fields.length);
        assert.deepStrictEqual(
            flattened.map((f) => f.name),
            fields.map((f) => f.name),
        );
    });

    it("respects the per-embed field cap", () => {
        const fields = Array.from({ length: MAX_FIELDS_PER_EMBED * 2 + 3 }, (_, i) => field(`f${i}`, 5));
        for (const embeds of paginateEmbedFields(fields)) {
            for (const embed of embeds) {
                assert.ok(embed.length <= MAX_FIELDS_PER_EMBED, `embed held ${embed.length} fields`);
            }
        }
    });

    it("respects the per-message embed cap", () => {
        const fields = Array.from({ length: 400 }, (_, i) => field(`f${i}`, 5));
        for (const embeds of paginateEmbedFields(fields, { fieldsPerEmbed: 1 })) {
            assert.ok(embeds.length <= MAX_EMBEDS_PER_MESSAGE, `message held ${embeds.length} embeds`);
        }
    });

    it("charges reserved title and description chars against every message", () => {
        const fields = Array.from({ length: 16 }, (_, i) => field(`f${i}`, 700));
        const withoutReserve = paginateEmbedFields(fields);
        const withReserve = paginateEmbedFields(fields, { reservedChars: 2000 });

        assert.ok(
            withReserve[0].flat().length < withoutReserve[0].flat().length,
            "reserving chars should push fields out of the first message",
        );
        for (const embeds of withReserve) {
            assert.ok(messageChars(embeds) + 2000 <= MAX_CHARS_PER_MESSAGE, "message plus its title exceeded the cap");
        }
    });

    it("emits an over-budget field alone rather than dropping it or looping forever", () => {
        const messages = paginateEmbedFields([field("huge", MAX_CHARS_PER_MESSAGE + 500), field("after", 10)]);
        const flattened = messages.flat(2);

        assert.deepStrictEqual(
            flattened.map((f) => f.name),
            ["huge", "after"],
        );
        assert.strictEqual(messages[0].flat().length, 1, "the over-budget field should not drag neighbours with it");
    });

    it("does not start an embed it cannot put a field in", () => {
        const fields = Array.from({ length: 20 }, (_, i) => field(`f${i}`, 800));
        for (const embeds of paginateEmbedFields(fields)) {
            for (const embed of embeds) {
                assert.ok(embed.length > 0, "emitted an empty embed");
            }
        }
    });
});
