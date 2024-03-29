const { ApplicationCommandOptionType, codeBlock } = require("discord.js");
const Command = require("../base/slashCommand");
const { typedDefaultSettings } = require("../config.js");
const { getGuildSettings, setGuildSettings } = require("../modules/guildConfig/settings.js");

// Set the base subargs up
const options = {
    add: {
        name: "add",
        description: "Add a value to one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: []
    },
    remove: {
        name: "remove",
        description: "Remove a value from one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: []
    },
    set: {
        name: "set",
        type: ApplicationCommandOptionType.Subcommand,
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
    };
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
            permLevel: 3,
            options: Object.values(options)
        });
    }

    async run(Bot, interaction) {
        if (!interaction?.guild?.id) {
            return super.error(interaction, "Sorry, but this command is only usable in servers");
        }

        const guildConf = await getGuildSettings({cache: Bot.cache, guildId: interaction.guild.id});
        if (!guildConf) {
            return super.error(interaction, "I cannot find a config for your guild. Please report this to the folks over at this bot's server, check `/info` for the invite code");
        }

        const subCommand = interaction.options.getSubcommand();

        const settingsIn = {};
        const errors = [];
        const changeLog = [];
        for (const key of Object.keys(typedDefaultSettings)) {
            const optionKey = key.replace(/[A-Z]/g, char => "_" + char.toLowerCase());
            const keyType = typedDefaultSettings[key]?.type;
            let settingStr = null;
            let nameStr = null;
            if (keyType === ApplicationCommandOptionType.String) {
                settingStr = interaction.options.getString(optionKey);
                if (!settingStr) continue;
                if (key === "timezone" && !Bot.isValidZone(settingStr)) {
                    // If it's not a valid timezone, let em know
                    errors.push(interaction.language.get("COMMAND_SETCONF_TIMEZONE_NEED_ZONE"));
                    continue;
                }
            } else if (keyType === ApplicationCommandOptionType.Integer) {
                settingStr = interaction.options.getInteger(optionKey);
                if (!settingStr) continue;
                if (key === "eventCountdown" && settingStr < 0) {
                    // Make sure the entered number is positive
                    errors.push(`${settingStr} is not a valid entry, it __must__ be above 0`);
                    continue;
                }
            } else if (keyType === ApplicationCommandOptionType.Boolean) {
                settingStr = interaction.options.getBoolean(optionKey);
                if (["enable_part", "enable_welcome"].includes(key) && settingStr === true) {
                    // If they're trying to enable the welcome or part message, make sure there's an announcement channel set up
                    if (!guildConf.announce_chan?.length) {
                        await interaction.channel.send("The welcome and parting messages will not work without an announcement channel set.");
                    }
                }
            } else if (keyType === ApplicationCommandOptionType.Channel) {
                const channel = interaction.options.getChannel(optionKey);
                if (!channel) continue;
                nameStr = "#" + channel.name;
                settingStr = channel.id;
            } else if (keyType === ApplicationCommandOptionType.Role) {
                settingStr = interaction.options.getRole(optionKey);
                if (!settingStr) continue;
            } else {
                errors.push(`[Setconf] Invalid keyType: ${keyType}`);
                continue;
            }

            const newSetting = changeSetting(subCommand, key, settingStr, nameStr);

            // If it got here, then the setting should be valid and changed
            if (newSetting !== null && newSetting !== guildConf[key]) {
                settingsIn[key] = newSetting;
            }
        }

        function changeSetting(action, key, setting, name) {
            if (setting === null) return null;
            if (action === "set") {
                // Just send back the setting
                changeLog.push(`Set ${key} to ${name ? name : setting}`);
                return setting;
            } else if (action === "add") {
                // Stick it into the old one
                const newArr = [...guildConf[key]];
                if (key === "adminRole") {
                    newArr.push(setting.id);
                    changeLog.push(`Added ${setting?.name} to AdminRole`);
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
            return super.error(interaction, codeBlock(errors.map(e => "* " + e).join("\n")));
        }

        if (Object.keys(settingsIn)?.length) {
            // Go through and make all the changes to the guildConf
            for (const key of Object.keys(settingsIn)) {
                guildConf[key] = settingsIn[key];
            }

            // Actually change stuff in the db
            await setGuildSettings({cache: Bot.cache, guildId: interaction.guild.id, settings: guildConf});
            return super.success(interaction, codeBlock(changeLog.map(c => `* ${c}`).join("\n")));
        } else {
            return super.error(interaction, "It looks like nothing needed to be updated");
        }
    }
}

module.exports = SetConf;
