const Command = require("../base/Command");

class UserConf extends Command {
    constructor(client) {
        super(client, {
            name: "userconf",
            category: "SWGoH",
            aliases: ["uc", "uconf"]
        });
    }

    async run(client, message, [target, action, ...args], options) { // eslint-disable-line no-unused-vars
        if (target) target = target.toLowerCase();
        if (action) action = action.toLowerCase();
        
        const userID = message.author.id;
        let user = await client.userReg.getUser(userID); // eslint-disable-line no-unused-vars 
        switch (target) {
            case "allycode": {
                // Allycode   -> add/remove/makePrimary
                let allyCode;
                if (!user) {
                    user = client.config.defaultUserConf;
                    user.id = userID;
                }
                if (!args[0]) {
                    // Missing ally code
                    return super.error(message, message.language.get("COMMAND_REGISTER_MISSING_ALLY"));
                } else {
                    if (client.isAllyCode(args[0])) {
                        allyCode = args[0].replace(/[^\d]*/g, "");
                    } else {
                        // Bad code, grumblin time
                        return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
                    }
                }
                if (action === "add") {
                    // Add to the list of ally codes, if the first, make it the primary
                    if (user.accounts.find(a => a.allyCode === allyCode)) {
                        return message.channel.send("You already have this ally code registered.");
                    }
                    // Sync up their swgoh account
                    try {
                        await client.swgohAPI.player(allyCode, "ENG_US").then(async (u) => {
                            if (!u) {
                                super.error(message, (message.language.get("COMMAND_REGISTER_FAILURE")));
                            } else {
                                user.accounts.push({
                                    allyCode: allyCode,
                                    name: u.name,
                                    primary: user.accounts.length ? false : true
                                });
                                await client.swgohAPI.register([
                                    [allyCode, userID]
                                ]);
                                message.channel.send(message.language.get("COMMAND_REGISTER_SUCCESS", u.name));
                            }
                        });
                    } catch (e) {
                        console.log("ERROR[REG]: Incorrect Ally Code(" + allyCode + "): " + e);
                        return super.error(message, ("Something broke. Make sure you've got the correct ally code" + client.codeBlock(e.message)));
                    }
                } else if (action === "remove") {
                    // Remove from the list, if the chosen one was the primary, set the 1st 
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    if (!acc) {
                        return message.channel.send("You do not already have this ally code registered.");
                    }
                    user.accounts.push({
                        allyCode: allyCode,
                        primary: user.accounts.length ? false : true
                    });
                    message.channel.send(`Removed **${acc.name}** (${acc.allyCode}) from your conf`);
                } else if (action === "makeprimary") {
                    // Set the selected ally code the primary one
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    const prim = user.accounts.find(a => a.primary);
                    if (!acc) {
                        return message.channel.send("You do not have this ally code registered.");
                    } else if (acc.primary) {
                        return message.channel.send("That ally code is already marked as the primary one.");
                    }
                    user.accounts = user.accounts.map(a => {
                        if (a.primary) a.primary = false;
                        if (a.allyCode === allyCode) a.primary = true;
                        return a;
                    });
                    message.channel.send(`Changed your primary from **${prim.name}**(${prim.allyCode}) to **${acc.name}**(${acc.allyCode})`);
                }
                await client.userReg.updateUser(userID, user);
                break;
            }
            case "defaults":
                // Defaults   -> per-command etc?   If there are no found flags when using ___ command, use your personal defaults (Have flag to cancel it?)
                return message.channel.send("This is not functional yet, coming soon.");
            case "arenaalert":
                // ArenaAlert -> activate/ set threshhold
                return message.channel.send("This is not functional yet, coming soon.");
            case "view": {
                // Show the user's settings/ config
                if (!user) {
                    return super.error(message, "You've not set up a config yet, try `" + message.guildSettings.prefix + "help userconf` to get started.");
                }
                const fields = [];
                fields.push({
                    name: "Ally Codes",
                    value: user.accounts.length ? "`Primary ally code is BOLD`\n" + user.accounts.map(a => "`" + a.allyCode + "`: " + (a.primary ? `**${a.name}**` : a.name)).join("\n") : "No linked ally codes."
                });
                fields.push({
                    name: "Defaults",
                    value: "Coming soon™"
                });
                return message.channel.send({embed: {
                    author: {name: message.author.username},
                    fields: fields
                }});
            }
            default:
                console.log(target, action, ...args);
                break;
        }
    }
}

module.exports = UserConf;

