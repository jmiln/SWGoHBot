import assert from "node:assert";
import { describe, it } from "node:test";
import { UserConfigSchema } from "../../schemas/users.schema.ts";

// Minimal valid UserConfig fixture — only fields required by the schema
const BASE_USER = {
    id: "12345",
    accounts: [],
    primaryAllyCode: null,
    arenaAlert: { arena: "none", payoutWarning: 0 },
    updated: Date.now(),
    arenaWatch: {
        allyCodes: [],
        channel: null,
        arena: {},
        payout: {
            char: { enabled: false, channel: null, msgID: null },
            fleet: { enabled: false, channel: null, msgID: null },
        },
    },
};

describe("UserConfigSchema", () => {
    it("accepts patreonAmountCents when present", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, patreonAmountCents: 500 });
        assert.strictEqual(result.success, true);
    });

    it("accepts absence of patreonAmountCents (optional field)", () => {
        const result = UserConfigSchema.safeParse(BASE_USER);
        assert.strictEqual(result.success, true);
    });

    it("rejects patreonAmountCents when it is not a number", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, patreonAmountCents: "not-a-number" });
        assert.strictEqual(result.success, false);
    });

    it("accepts accounts as a flat array of numbers", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, accounts: [123456789, 987654321] });
        assert.strictEqual(result.success, true);
    });

    it("rejects accounts containing non-numbers", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, accounts: ["notanumber"] });
        assert.strictEqual(result.success, false);
    });

    it("accepts primaryAllyCode as a number", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, primaryAllyCode: 123456789 });
        assert.strictEqual(result.success, true);
    });

    it("accepts primaryAllyCode as null", () => {
        const result = UserConfigSchema.safeParse({ ...BASE_USER, primaryAllyCode: null });
        assert.strictEqual(result.success, true);
    });

    it("accepts arenaWatch.allyCodes with lean watch-config entries", () => {
        const result = UserConfigSchema.safeParse({
            ...BASE_USER,
            arenaWatch: {
                ...BASE_USER.arenaWatch,
                allyCodes: [{ allyCode: 123456789, mention: null, poOffset: -300 }],
            },
        });
        assert.strictEqual(result.success, true);
    });

    it("rejects arenaWatch.allyCodes entries missing allyCode", () => {
        const result = UserConfigSchema.safeParse({
            ...BASE_USER,
            arenaWatch: {
                ...BASE_USER.arenaWatch,
                allyCodes: [{ mention: null, poOffset: 0 }],
            },
        });
        assert.strictEqual(result.success, false);
    });
});
