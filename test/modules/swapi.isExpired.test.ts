import assert from "node:assert";
import { describe, it } from "node:test";
import swapi from "../../modules/swapi.ts";
import type { PlayerCooldown } from "../../types/types.ts";

const MINUTE_MS = 60_000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE_MS);

// isExpired is private; tests reach it through a structural cast rather than widening its visibility
const isExpired = (updatedAt: Date | undefined, cooldown: PlayerCooldown, guild = false): boolean =>
    (swapi as unknown as { isExpired: (u: Date | undefined, c: PlayerCooldown, g: boolean) => boolean }).isExpired(
        updatedAt,
        cooldown,
        guild,
    );

describe("SWAPI isExpired", () => {
    it("treats a document carrying only the legacy epoch-ms `updated` as expired, so it is re-fetched", () => {
        const legacyDoc: { updated: number; updatedAt?: Date } = { updated: Date.now() };
        assert.strictEqual(isExpired(legacyDoc.updatedAt, { player: 5, guild: 5 }), true);
    });

    it("keeps a player fetched inside the player cooldown", () => {
        assert.strictEqual(isExpired(minutesAgo(4), { player: 5, guild: 5 }), false);
    });

    it("expires a player once the player cooldown has passed", () => {
        assert.strictEqual(isExpired(minutesAgo(6), { player: 5, guild: 5 }), true);
    });

    it("applies the guild cooldown, not the player one, when asked for a guild", () => {
        const fetched = minutesAgo(10);
        assert.strictEqual(isExpired(fetched, { player: 60, guild: 5 }, true), true, "10 min is past a 5 min guild cooldown");
        assert.strictEqual(isExpired(fetched, { player: 60, guild: 5 }, false), false, "10 min is inside a 60 min player cooldown");
    });
});
