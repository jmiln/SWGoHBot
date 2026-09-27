import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indexOptionMismatches } from "../../scripts/verifyIndexes.ts";

describe("indexOptionMismatches", () => {
    it("reports a TTL the existing index on the same key lacks", () => {
        // The commandStats failure: a plain index on {timestamp: 1} was accepted as the TTL index
        const existing = { v: 2, key: { timestamp: 1 }, name: "idx_commandstats_timestamp" };
        const target = { key: { timestamp: 1 as const }, options: { name: "idx_commandstats_ttl", expireAfterSeconds: 7776000 } };

        assert.deepEqual(indexOptionMismatches(existing, target), ["expireAfterSeconds: expected 7776000, found none"]);
    });

    it("reports unique and sparse differences", () => {
        const existing = { v: 2, key: { allyCode: 1 }, name: "allyCode_1", sparse: true };
        const target = { key: { allyCode: 1 as const }, options: { unique: true } };

        assert.deepEqual(indexOptionMismatches(existing, target), [
            "unique: expected true, found false",
            "sparse: expected false, found true",
        ]);
    });

    it("ignores the name and background, and treats an absent flag as false", () => {
        const existing = { v: 2, key: { discordID: 1 }, name: "discordID_1", unique: true, sparse: false };
        const target = { key: { discordID: 1 as const }, options: { name: "idx_patrons_discordid", unique: true, background: true } };

        assert.deepEqual(indexOptionMismatches(existing, target), []);
    });
});
