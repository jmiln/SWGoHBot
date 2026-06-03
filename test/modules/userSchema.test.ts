import assert from "node:assert";
import { describe, it } from "node:test";
import { UserConfigSchema } from "../../schemas/users.schema.ts";

// Minimal valid UserConfig fixture — only fields required by the schema
const BASE_USER = {
    id: "12345",
    accounts: [],
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

    it("accepts accounts with charHist and shipHist", () => {
        const user = {
            ...BASE_USER,
            accounts: [
                {
                    allyCode: 123456789,
                    name: "TestPlayer",
                    primary: true,
                    charHist: [{ rank: 42, ts: 1700000000000 }],
                    shipHist: [{ rank: 7, ts: 1700000000000 }],
                },
            ],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, true);
    });

    it("accepts accounts without charHist or shipHist (optional fields)", () => {
        const user = {
            ...BASE_USER,
            accounts: [{ allyCode: 123456789, name: "TestPlayer", primary: true }],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, true);
    });

    it("rejects charHist entries missing rank", () => {
        const user = {
            ...BASE_USER,
            accounts: [
                {
                    allyCode: 123456789,
                    name: "TestPlayer",
                    primary: true,
                    charHist: [{ ts: 1700000000000 }],
                },
            ],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, false);
    });

    it("rejects charHist entries missing ts", () => {
        const user = {
            ...BASE_USER,
            accounts: [
                {
                    allyCode: 123456789,
                    name: "TestPlayer",
                    primary: true,
                    charHist: [{ rank: 42 }],
                },
            ],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, false);
    });

    it("rejects charHist entries with non-number rank", () => {
        const user = {
            ...BASE_USER,
            accounts: [
                {
                    allyCode: 123456789,
                    name: "TestPlayer",
                    primary: true,
                    charHist: [{ rank: "top", ts: 1700000000000 }],
                },
            ],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, false);
    });

    it("rejects shipHist entries missing ts", () => {
        const user = {
            ...BASE_USER,
            accounts: [
                {
                    allyCode: 123456789,
                    name: "TestPlayer",
                    primary: true,
                    shipHist: [{ rank: 7 }],
                },
            ],
        };
        const result = UserConfigSchema.safeParse(user);
        assert.strictEqual(result.success, false);
    });
});
