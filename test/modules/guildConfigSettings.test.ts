import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import cache from "../../modules/cache.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import { getGuildSettings } from "../../modules/guildConfig/settings.ts";
import { defaultGuildSettings } from "../../schemas/guildConfigs.schema.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";

const NO_DOC_GUILD = "guild-config-settings-test-no-doc";
const STORED_GUILD = "guild-config-settings-test-stored";

describe("getGuildSettings", () => {
    before(async () => {
        cache.init(await getMongoClient());
        await guildConfigDB.remove({ guildId: NO_DOC_GUILD });
        await guildConfigDB.put({ guildId: STORED_GUILD }, { guildId: STORED_GUILD, settings: { timezone: "Europe/London" } }, false);
    });

    after(async () => {
        await guildConfigDB.remove({ guildId: NO_DOC_GUILD });
        await guildConfigDB.remove({ guildId: STORED_GUILD });
        await closeMongoClient();
    });

    for (const [label, guildId] of [
        ["a guild with no saved config", NO_DOC_GUILD],
        ["a guild with a saved config", STORED_GUILD],
        ["a missing guild id", undefined],
    ] as const) {
        it(`returns settings that do not share objects with the defaults for ${label}`, async () => {
            const settings = await getGuildSettings({ guildId });

            assert.notStrictEqual(settings, defaultGuildSettings);
            assert.notStrictEqual(settings.adminRole, defaultGuildSettings.adminRole);
            assert.notStrictEqual(settings.eventCountdown, defaultGuildSettings.eventCountdown);
        });
    }

    it("merges stored settings over the defaults", async () => {
        const settings = await getGuildSettings({ guildId: STORED_GUILD });
        assert.deepStrictEqual(settings, { ...defaultGuildSettings, timezone: "Europe/London" });
    });
});
