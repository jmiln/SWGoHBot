import assert from "node:assert";
import { describe, it } from "node:test";
import { setconfOptions } from "../../data/constants/setconfOptions.ts";
import { defaultGuildSettings, GuildConfigSettingsSchema } from "../../schemas/guildConfigs.schema.ts";

describe("guild settings defaults", () => {
    it("defaults satisfy the settings schema", () => {
        // The GuildConfigSettings annotation on defaultGuildSettings is a compile-time check.
        // This is the runtime contract the website depends on when it imports the schema.
        const result = GuildConfigSettingsSchema.safeParse(defaultGuildSettings);
        assert.ok(result.success, `defaultGuildSettings failed validation: ${JSON.stringify(result.error?.issues)}`);
    });

    it("every setting has a matching /setconf option", () => {
        // Backs up the Record<keyof GuildConfigSettings> type on setconfOptions, so a missing
        // entry fails here rather than only as a type error.
        const schemaKeys = Object.keys(GuildConfigSettingsSchema.shape).sort();
        assert.deepStrictEqual(Object.keys(setconfOptions).sort(), schemaKeys);
    });

    it("language choices offered by /setconf are accepted by the schema", () => {
        for (const choice of setconfOptions.language.choices ?? []) {
            assert.ok(
                GuildConfigSettingsSchema.shape.language.safeParse(choice).success,
                `/setconf offers language "${choice}" but the schema rejects it`,
            );
        }
        for (const choice of setconfOptions.swgohLanguage.choices ?? []) {
            assert.ok(
                GuildConfigSettingsSchema.shape.swgohLanguage.safeParse(choice).success,
                `/setconf offers swgohLanguage "${choice}" but the schema rejects it`,
            );
        }
    });
});
