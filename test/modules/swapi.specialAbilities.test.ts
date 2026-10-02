import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import swgohAPI, { refreshMapFiles } from "../../modules/swapi.ts";
import type { SWAPIUnitAbility } from "../../types/swapi_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const EXISTING_SKILL_ID = "test_special_ability_existing";
const NEW_SKILL_ID = "test_special_ability_added";

describe("SWAPI zeta/omicron ability list", () => {
    let client: MongoClient;
    let mapDir: string;

    const abilities = () => client.db(env.MONGODB_SWAPI_DB).collection("abilities");
    const getSpecialAbilities = () =>
        (swgohAPI as unknown as { getSpecialAbilities: () => Promise<Map<string, SWAPIUnitAbility>> }).getSpecialAbilities();

    before(async () => {
        client = await getMongoClient();
        cache.init(client);
        await abilities().deleteMany({ skillId: { $in: [EXISTING_SKILL_ID, NEW_SKILL_ID] } });

        mapDir = await mkdtemp(path.join(tmpdir(), "swapi-maps-"));
        for (const file of ["modMap.json", "unitMap.json", "skillMap.json"]) {
            await writeFile(path.join(mapDir, file), "{}");
        }
    });

    after(async () => {
        await abilities().deleteMany({ skillId: { $in: [EXISTING_SKILL_ID, NEW_SKILL_ID] } });
        await rm(mapDir, { recursive: true, force: true });
        await closeMongoClient();
    });

    it("picks up abilities dataUpdater added since the list was loaded, once the data files refresh", async () => {
        await abilities().insertOne({ skillId: EXISTING_SKILL_ID, language: "eng_us", isZeta: true, zetaTier: 7 });
        assert.ok((await getSpecialAbilities()).has(EXISTING_SKILL_ID), "the list should load what is stored");

        await abilities().insertOne({ skillId: NEW_SKILL_ID, language: "eng_us", isOmicron: true, omicronTier: 8, omicronMode: 7 });
        await refreshMapFiles(mapDir);

        const refreshed = await getSpecialAbilities();
        assert.strictEqual(refreshed.get(NEW_SKILL_ID)?.omicronTier, 8, "a new unit's omicron must be known without a restart");
        assert.ok(refreshed.has(EXISTING_SKILL_ID), "and the existing ones kept");
    });
});
