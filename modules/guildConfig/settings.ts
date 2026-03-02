import { defaultSettings } from "../../data/constants/defaultGuildConf.ts";
import { guildConfigDB } from "./db.ts";

// Get the guildsettings from the mongo db
export async function getGuildSettings({ guildId }: { guildId: string }) {
    if (!guildId) return defaultSettings;

    const guildSettings = await guildConfigDB.getOne({ guildId: guildId }, { settings: 1 });
    if (!guildSettings) return defaultSettings;
    return { ...defaultSettings, ...(guildSettings.settings as object) };
}

// Set any guildSettings that do not match the defaultSettings in the bot's config
export async function setGuildSettings({ guildId, settings }: { guildId: string; settings: typeof defaultSettings }) {
    // Filter out any settings that are the same as the defaults
    const customSettings = {};

    for (const key of Object.keys(defaultSettings)) {
        const configVal = defaultSettings[key];
        if (Array.isArray(configVal)) {
            if (!arrayEquals(configVal, settings[key])) {
                customSettings[key] = settings[key];
            }
        } else if (defaultSettings[key] !== settings[key]) {
            customSettings[key] = settings[key];
        }
    }

    if (!Object.keys(customSettings).length) {
        // In this case, there's nothing different than the default, so go ahead and set it to blank
        return await guildConfigDB.put({ guildId: guildId }, { settings: {} }, false);
    }
    return await guildConfigDB.put({ guildId: guildId }, { settings: customSettings }, false);
}

// Check if there are settings for the guild
export async function hasGuildSettings(guildId: string) {
    const guildSettings = await guildConfigDB.getOne({ guildId: guildId }, { settings: 1 });
    if (guildSettings) {
        return true;
    }
    return false;
}

// Remove all settings, events, polls, etc for the given guild
export async function deleteGuildConfig({ guildId }: { guildId: string }) {
    return await guildConfigDB.remove({ guildId: guildId });
}

function arrayEquals(a: unknown, b: unknown) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (!a?.length || !b?.length) return false;
    return a.length === b.length && a.every((val, index) => val === b[index]);
}
