const Command = require("../base/Command");

class ArenaAlert extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenaalert",
            category: "Patreon",
            aliases: ["aa"],
            permissions: ["EMBED_LINKS"],
            flags: {},
            subArgs: {}
        });
    }

    async run(Bot, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];
        if (action) action = action.toLowerCase();

        let userID = message.author.id;

        if (options.subArgs.user && options.level < 9) {
            return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        } else if (options.subArgs.user) {
            userID = options.subArgs.user.replace(/[^\d]*/g, "");
            if (!Bot.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
        }

        const user = await Bot.userReg.getUser(userID); // eslint-disable-line no-unused-vars
        if (!user) {
            return super.error(message, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }

        // ArenaAlert -> activate/ deactivate
        const pat = Bot.getPatronUser(message.author.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(message, message.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }
        const setting = args.length ? args[0].toLowerCase() : null;
        if (action === "enabledms") {
            // Set it to enable the DM alerts entirely or not
            if (!setting) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_MISSING_DM"));
            } else if (setting === "all" && pat.amount_cents < 500) {
                return super.error(message, "Sorry, but you can only set up alerts for the allycode you have set as your primary.");
            }
            if (["all", "primary"].includes(setting)) {
                user.arenaAlert.enableRankDMs = setting;
            } else if (offVar.includes(setting)) {
                user.arenaAlert.enableRankDMs = "off";
            } else {
                // They entered an invalid choice
                return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_DM"));
            }
        } else if (action === "arena") {
            // Set which arena you want watched
            if (!setting) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_MISSING_ARENA"));
            } else if (!["char", "fleet", "both", "none"].includes(setting)) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_ARENA"));
            }
            user.arenaAlert.arena = setting;
        } else if (action === "payoutresult") {
            // Set it to tell you the result at your payout
            if (!setting) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_MISSING_BOOL"));
            }
            if (onVar.includes(setting)) {
                user.arenaAlert.enablePayoutResult = true;
            } else if (offVar.includes(setting)) {
                user.arenaAlert.enablePayoutResult = false;
            } else {
                // They entered an invalid choice
                return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_BOOL"));
            }
        } else if (action === "payoutwarning") {
            // Set it to warn you x minutes ahead of your payout
            if (!setting) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_MISSING_WARNING"));
            } else if (isNaN(setting)) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_WARNING"));
            } else if (parseInt(setting) < 0 || parseInt(setting) > 1440) {
                return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_NUMBER"));
            }
            user.arenaAlert.payoutWarning = parseInt(setting);
        } else if (["view", "check"].indexOf(action) > -1) {
            // Show the current settings
            return message.channel.send({embed: {
                title: message.language.get("COMMAND_ARENAALERT_VIEW_HEADER"),
                description: [
                    `${message.language.get("COMMAND_ARENAALERT_VIEW_DM")}: **${user.arenaAlert.enableRankDMs ? user.arenaAlert.enableRankDMs : "N/A"}**`,
                    `${message.language.get("COMMAND_ARENAALERT_VIEW_SHOW")}: **${user.arenaAlert.arena}**`,
                    `${message.language.get("COMMAND_ARENAALERT_VIEW_WARNING")}: **${user.arenaAlert.payoutWarning ? user.arenaAlert.payoutWarning + " min" : "disabled"}**`,
                    `${message.language.get("COMMAND_ARENAALERT_VIEW_RESULT")}: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`
                ].join("\n")
            }});
        } else {
            return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_OPTION"), {title: "Invalid Option"});
        }
        await Bot.userReg.updateUser(userID, user);
        return super.error(message, message.language.get("COMMAND_ARENAALERT_UPDATED"), {title: "Success!", color: "#00FF00"});
    }
}

module.exports = ArenaAlert;
