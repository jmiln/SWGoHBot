import assert from "node:assert";
import { describe, it } from "node:test";
import { mapArenaProfile } from "../../modules/swapi.ts";
import type { SWAPIPlayerArenaProfile } from "../../types/swapi_types.ts";

// The interface carries a dozen fields the mapping never reads, so fixtures assert only the
// shape under test and cast. Keeping the cast here rather than loosening the parameter type
// means production callers still get the full type checked.
function profile(overrides: Partial<SWAPIPlayerArenaProfile> = {}): SWAPIPlayerArenaProfile {
    return {
        name: "Testy",
        allyCode: "911111111",
        localTimeZoneOffsetMinutes: 300,
        pvpProfile: [
            { tab: 1, rank: 12 },
            { tab: 2, rank: 34 },
        ],
        ...overrides,
    } as SWAPIPlayerArenaProfile;
}

describe("mapArenaProfile", () => {
    it("maps char rank from tab 1 and ship rank from tab 2", () => {
        const out = mapArenaProfile(profile());

        assert.deepStrictEqual(out, {
            name: "Testy",
            allyCode: 911111111,
            arena: { char: { rank: 12 }, ship: { rank: 34 } },
            poUTCOffsetMinutes: 300,
        });
    });

    // This is the batch-loss guard. The arena tick fetches every watched account in one batch,
    // so a throw here would cost every account in that batch a minute of rank tracking, and a
    // payout record for anyone whose payout cycle landed on that minute.
    it("returns null instead of throwing when pvpProfile is missing", () => {
        assert.strictEqual(mapArenaProfile(profile({ pvpProfile: undefined })), null);
    });

    it("returns null for a null profile", () => {
        assert.strictEqual(mapArenaProfile(null), null);
    });

    // An empty pvpProfile already produced null ranks rather than an error, and downstream
    // processArenaAlerts skips on null ranks. Preserve that rather than folding it into the guard.
    it("keeps null ranks for an empty pvpProfile rather than dropping the player", () => {
        const out = mapArenaProfile(profile({ pvpProfile: [] }));

        assert.deepStrictEqual(out?.arena, { char: { rank: null }, ship: { rank: null } });
    });
});
