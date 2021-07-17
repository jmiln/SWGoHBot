const Command = require("../base/Command");

class GuildUpdate extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildupdate",
            category: "Patreon",
            aliases: ["gu"],
            permissions: ["EMBED_LINKS"],
            flags: {},
            subArgs: {
                mark: {
                    aliases: []
                }
            }
        });
    }

    async run(Bot, message, [target, ...args], options) { // eslint-disable-line no-unused-vars
        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];
        const cmdOut = null;

        const outLog = [];

        if (target) target = target.toLowerCase();

        let userID = message.author.id;

        if (options.subArgs.user && options.level < 9) {
            return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        } else if (options.subArgs.user) {
            userID = options.subArgs.user.replace(/[^\d]*/g, "");
            if (!Bot.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
        }

        const user = await Bot.userReg.getUser(userID);
        if (!user) {
            return super.error(message, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }
        let gu = user.guildUpdate;
        const defGU = {
            enabled: false,
            channel: null,
            allycode: null
        };
        if (!gu) {
            gu = defGU;
        }

        // GuildUpdate -> activate/ deactivate
        const pat = await Bot.getPatronUser(message.author.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(message, message.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        switch (target) {
            case "enable":
            case "enabled":
                if (!args.length) {
                    // They didn't say which way, so just toggle it
                    gu.enabled = !gu.enabled;
                } else {
                    const toggle = args[0];
                    if (onVar.indexOf(toggle) > -1) {
                        // Turn it on
                        gu.enabled = true;
                    } else if (offVar.indexOf(toggle) > -1) {
                        // Turn it off
                        gu.enabled = false;
                    } else {
                        // Complain, they didn't supply a proper toggle
                        return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_BOOL"));
                    }
                }
                break;
            case "ch":
            case "channel": {
                // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
                let [channel] = args;
                if (!channel) {
                    if (gu.arena.char.channel || gu.arena.fleet.channel) {
                        gu.arena.char.channel  = null;
                        gu.arena.fleet.channel = null;
                    } else {
                        return super.error(message, "Missing channel");
                    }
                }
                if (!channel || !Bot.isChannelMention(channel)) return super.error(message, "Invalid channel");

                channel = channel.replace (/[^\d]/g, "");
                if (!message.guild.channels.cache.get(channel)) return super.error(message, "I cannot find that channel here.");

                // If it gets this far, it should be a valid code
                // Need to make sure that the user has the correct permissions to set this up
                if (options.level < 3) {
                    return super.error(message, message.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }

                // They got throught all that, go ahead and set it
                gu.channel = channel;
                break;
            }
            case "ac":
            case "allycode": {
                const [code] = args;
                if (!code) {
                    // Remove the code
                    gu.allycode = null;
                } else {
                    if (!Bot.isAllyCode(code))  return super.error(message, message.language.get("COMMAND_ARENAWATCH_INVALID_AC"));
                    const player = await Bot.swgohAPI.unitStats(code);
                    if (!player?.length) {
                        // Invalid code
                        return super.error(message, "I could not find a match for your ally code. Please double check that it is correct.");
                    }
                    gu.allycode = parseInt(code, 10);
                }
                break;
            }
            case "view":
                // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
                return message.channel.send({embed: {
                    title: `Guild update settings for ${message.author.name}`,
                    description: [
                        `Enabled:  **${gu.enabled ? "ON" : "OFF"}**`,
                        `Channel:  **${gu.channel ? "<#" + gu.channel + ">" : "N/A"}**`,
                        `Allycode: **${gu.allycode ? gu.allycode : "N/A"}**`
                    ].join("\n")
                }});
            default:
                return super.error(message, message.language.get("COMMAND_ARENAWATCH_INVALID_OPTION"));
        }
        if (target !== "view") {
            user.guildUpdate = gu;
            await Bot.userReg.updateUser(userID, user);
        }
        return super.error(message, outLog.length ? outLog.join("\n") : message.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: "#0000FF"});
    }
}


module.exports = GuildUpdate;
