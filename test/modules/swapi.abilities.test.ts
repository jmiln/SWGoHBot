import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import type { SWAPILang } from "../../types/swapi_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

// Regression coverage for the production crash:
//   TypeError: Cannot read properties of null (reading 'toLowerCase')
//       at SWAPI.abilities (modules/swapi.ts)
// /zetas guild called abilities(skill, null, { min: true }). The default parameter
// value ("eng_us") only applies to `undefined`, so a `null` lang reached
// `lang.toLowerCase()` and threw. Every sibling lang method (gear/units/unitNames/
// recipes/getCharacter/langChar) already guards against a falsy lang; abilities was
// the lone outlier. These tests lock in that abilities tolerates a missing language.
describe("SWAPI abilities() language handling", () => {
    let client: MongoClient;
    const SKILL_ID = "test_skill_abilities_lang";
    const NAME_KEY = "TEST_ABILITY_NAME";

    before(async () => {
        client = await getMongoClient();
        // swapi.ts uses the shared cache singleton; point it at the test mongo.
        cache.init(client);

        // Seed an eng_us ability so a defaulted (null/undefined) language resolves to it.
        await client
            .db(env.MONGODB_SWAPI_DB)
            .collection("abilities")
            .insertOne({ skillId: SKILL_ID, language: "eng_us", nameKey: NAME_KEY });
    });

    after(async () => {
        await client.db(env.MONGODB_SWAPI_DB).collection("abilities").deleteMany({ skillId: SKILL_ID });
        await closeMongoClient();
    });

    it("does not throw and defaults to eng_us when lang is null (min)", async () => {
        const res = await swgohAPI.abilities(SKILL_ID, null as unknown as SWAPILang, { min: true });
        assert.deepStrictEqual(res, [{ nameKey: NAME_KEY }]);
    });

    it("defaults to eng_us when lang is undefined (min)", async () => {
        const res = await swgohAPI.abilities(SKILL_ID, undefined, { min: true });
        assert.deepStrictEqual(res, [{ nameKey: NAME_KEY }]);
    });

    it("does not throw when lang is null (full)", async () => {
        await assert.doesNotReject(swgohAPI.abilities(SKILL_ID, null as unknown as SWAPILang));
    });

    it("lowercases an uppercase lang", async () => {
        const res = await swgohAPI.abilities(SKILL_ID, "ENG_US" as SWAPILang);
        assert.strictEqual(res.length, 1);
        assert.strictEqual(res[0].nameKey, NAME_KEY);
    });
});
