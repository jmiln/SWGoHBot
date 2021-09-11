const moment = require("moment-timezone")
const Command = require("../base/slashCommand");
const { typedDefaultSettings } = require("../config.js");
// const { inspect } = require("util");

// Set the base subargs up
const options = {
    add: {
        name: "add",
        description: "Add a value to one of the array settings",
        type: "SUB_COMMAND",
        options: []
    },
    remove: {
        name: "remove",
        description: "Remove a value from one of the array settings",
        type: "SUB_COMMAND",
        options: []
    },
    set: {
        name: "set",
        type: "SUB_COMMAND",
        description: "Set the value of one of the options",
        options: []
    }
};

// Check out each option in the config file, and set it up in each subarg as needed
Object.keys(typedDefaultSettings).forEach(set => {
    // Fill out the options based on the default settings in the config file
    const thisSet = typedDefaultSettings[set];
    const optOut = {
        name: set.replace(/[A-Z]/g, char => "_" + char.toLowerCase()),
        type: thisSet.type,
        description: thisSet.description
    }
    if (thisSet?.choices) {
        optOut["choices"] = thisSet.choices.map(choice => {
            return {
                name: choice,
                value: choice
            };
        });
    }
    if (thisSet.isArray) {
        options.add.options.push(optOut);
        options.remove.options.push(optOut);
    } else {
        options.set.options.push(optOut);
    }
});


class SetConf extends Command {
    constructor(Bot) {
        super(Bot, {
            guildOnly: false,
            name: "setconf",
            aliases: ["setconfig"],
            permLevel: 3,
            category: "Admin",
            options: Object.values(options)
        });
    }

    async run(Bot, interaction) {
        if (!interaction?.guild?.id) {
            return super.error(interaction, "Sorry, but this command is only usable in servers");
        }

        const guildConf = await Bot.getGuildConf(interaction.guild.id);
        if (!guildConf) {
            return super.error(interaction, "I cannot find a config for your guild. Please report this to the folks over at this bot's server, check `;info` or `/info` for the invite code");
        }

        const subCommand = interaction.options.getSubcommand();

        const settingsIn = {};
        const errors = [];
        const changeLog = [];
        for (const key of Object.keys(typedDefaultSettings)) {
            const optionKey = key.replace(/[A-Z]/g, char => "_" + char.toLowerCase());
            const keyType = typedDefaultSettings[key]?.type;
            let settingStr = null;
            if (keyType === "STRING") {
                settingStr = interaction.options.getString(optionKey);
                if (!settingStr) continue;
                if (key === "prefix" && (settingStr.indexOf(" ") > -1 || settingStr.length > 3)) {
                    // Tell em it cannot have spaces & it has to be shorter than 3 characters
                    errors.push("Prefixes are limited to 3 characters & cannot include spaces");
                    continue;
                } else if (key === "timezone" && !moment.tz.zone(settingStr)) {
                    // If it's not a valid timezone, let em know
                    errors.push(message.language.get("COMMAND_SETCONF_TIMEZONE_NEED_ZONE"));
                    continue;
                }
            } else if (keyType === "INTEGER") {
                settingStr = interaction.options.getInteger(optionKey);
                if (!settingStr) continue;
                if (key === "eventCountdown" && settingStr < 0) {
                    // Make sure the entered number is positive
                    errors.push(`${settingStr} is not a valid entry, it __must__ be above 0`);
                    continue;
                }
            } else if (keyType === "BOOLEAN") {
                settingStr = interaction.options.getBoolean(optionKey);
                if (!settingStr) continue;
            } else if (keyType === "CHANNEL") {
                settingStr = interaction.options.getChannel(optionKey);
                if (!settingStr) continue;
            } else if (keyType === "ROLE") {
                settingStr = interaction.options.getRole(optionKey);
                if (!settingStr) continue;
            } else {
                errors.push(`[Setconf] Invalid keyType: ${keyType}`);
                continue;
            }

            const newSetting = changeSetting(subCommand, key, settingStr);

            // If it got here, then the setting should be valid and changed
            if (newSetting !== null && newSetting !== guildConf[key]) {
                settingsIn[key] = newSetting;
            }
        }

        function changeSetting(action, key, setting) {
            if (setting === null) return null;
            if (action === "set") {
                // Just send back the setting
                changeLog.push(`Set ${key} to ${setting}`);
                return setting;
            } else if (action === "add") {
                // Stick it into the old one
                const newArr = [...guildConf[key]];
                if (key === "adminRole") {
                    newArr.push(setting.id);
                    changeLog.push(`Added ${setting.name} to AdminRoles`);
                } else {
                    newArr.push(setting);
                    changeLog.push(`Added ${setting} to ${key}`);
                }

                return [...new Set(newArr)];
            } else if (action === "remove") {
                // Take out a setting from an array
                let newArr = [...guildConf[key]];
                if (key === "adminRole") {
                    newArr = newArr.filter(s => s !== setting.id && s !== setting.name);
                    changeLog.push(`Removed ${setting.id} from ${key}`);
                } else {
                    newArr = newArr.filter(s => s !== setting);
                    changeLog.push(`Removed ${setting} from ${key}`);
                }

                return [...new Set(newArr)];
            }
        }

        // If there are any errors, tell em and don't actually change anything
        if (errors.length) {
            return super.error(interaction, Bot.codeBlock(errors.map(e => "* " + e).join("\n")));
        }

        if (Object.keys(settingsIn)?.length) {
            // Go through and make all the changes to the guildConf
            for (const key of Object.keys(settingsIn)) {
                guildConf[key] = settingsIn[key];
            }

            // Actually change stuff in the db
            await Bot.database.models.settings.update(guildConf, {where: {guildID: interaction.guild.id}});
            return super.success(interaction, Bot.codeBlock(changeLog.map(c => `* ${c}`)));
        } else {
            return super.error(interaction, "It looks like nothing needed to be updated");
        }
    }
}

module.exports = SetConf;
