import assert from "node:assert";
import { describe, it } from "node:test";
import dataUpdater from "../../services/dataUpdater.ts";

const { shouldKeepLocalizationRow } = dataUpdater;

// Prefixes verified 2026-07-21 against the cached gameData blob, which references 503 distinct
// DATACRON_* keys: CHARACTER (273), FACTION (106), MATERIAL (56), ALIGNMENT (38), HELP (10),
// SET (9), ROLE (9), CURRENCY (2). We render the first, second, fourth, sixth and seventh.
describe("shouldKeepLocalizationRow", () => {
    it("keeps the datacron rows the commands render", () => {
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_SET_30_NAME|Set 30"), true);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_CHARACTER_MECHANIC_NAME|Character"), true);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_FACTION_MECHANIC_NAME|Faction"), true);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_ALIGNMENT_MECHANIC_NAME|Alignment"), true);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_ROLE_ATTACKER_NAME|Attacker"), true);
    });

    it("drops datacron rows we never render", () => {
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_MATERIAL_REROLL_A_1_NAME|Reroll Token"), false);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_HELP_OVERVIEW_BODY|Tap to continue"), false);
        assert.strictEqual(shouldKeepLocalizationRow("DATACRON_CURRENCY_NAME|Datacron Dust"), false);
    });

    it("still drops the pre-existing ignore keys", () => {
        assert.strictEqual(shouldKeepLocalizationRow("KEY_MAPPING_THING|x"), false);
        assert.strictEqual(shouldKeepLocalizationRow("ANNIVERSARY_BANNER|x"), false);
        assert.strictEqual(shouldKeepLocalizationRow("SUBSCRIPTION_OFFER|x"), false);
        assert.strictEqual(shouldKeepLocalizationRow("PROMO_THING|x"), false);
    });

    it("keeps ordinary unrelated rows", () => {
        assert.strictEqual(shouldKeepLocalizationRow("UNIT_JEDIKNIGHTREVAN_NAME|Jedi Knight Revan"), true);
    });

    it("does not drop a normal row merely for containing an ignore word in its value", () => {
        // The previous whole-row substring match had this flaw: a legitimate ability description
        // could be dropped because its translated text happened to mention an ignored word.
        assert.strictEqual(shouldKeepLocalizationRow("ABILITY_DESC_X|Grants a bonus during the anniversary event"), true);
        assert.strictEqual(shouldKeepLocalizationRow("ABILITY_DESC_Y|Ignores the datacron bonus"), true);
    });

    it("skips comments and malformed rows", () => {
        assert.strictEqual(shouldKeepLocalizationRow("# a comment"), false);
        assert.strictEqual(shouldKeepLocalizationRow(""), false);
        assert.strictEqual(shouldKeepLocalizationRow("|no key"), false);
    });
});
