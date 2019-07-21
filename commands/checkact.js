const Command = require("../base/Command");
const moment = require("moment");
require("moment-duration-format");

class CheckAct extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "checkact",
            aliases: ["activity", "check"],
            guildOnly: true,
            permLevel: 3,
            category: "Admin",
            flags: {},
            subArgs: {
                sort: {
                    aliases: []
                },
                time: {
                    aliases: ["hour", "hours"]
                },
                role: {
                    aliases: []
                }
            }
        });
    }

    async run(Bot, message, args, options) {
        let userID = args[0];
        console.log("Trying to check: " + userID);
        let activityLog = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: message.guild.id});
        if (Array.isArray(activityLog)) activityLog = activityLog[0];
        if (!userID) {
            // List everything for that server (With limitations)
            let objArr = Object.keys(activityLog.log).map(u => {
                return {
                    user: u,
                    time: activityLog.log[u]
                };
            });
            for (const u of objArr) {
                const user = await message.guild.members.get(u.user);
                u.user = user.user.username;
                u.roles = user.roles;
            }
            if (options.subArgs.time && !isNaN(options.subArgs.time)) {
                // Convert the time from hours to milliseconds
                //                                   ms    sec  min
                const time = options.subArgs.time * 1000 * 60 * 60;
                // Filter out anyone that has been inactive for longer than x hours
                objArr = objArr.filter(u => {
                    const diff = moment().diff(moment(u.time));
                    return diff >= time;
                });
            }
            if (options.subArgs.role && options.subArgs.role.length > 0) {
                // Filter out anyone that does not have the specified role (Name or mention/ id)
                const roleNId = options.subArgs.role;
                // Try finding by ID first
                let role = message.guild.roles.get(roleNId.replace(/[^0-9]/gi, ""));
                if (!role) {
                    // If it can't find the role by ID, try by name
                    role = message.guild.roles.find(r => r.name === roleNId);
                }
                if (!role) {
                    // If it can't find it by role or name, error
                    return super.error(message, "Cannot find role **" + roleNId + "**");
                }
                // Now that we have a role, filter out anyone that doens't have it
                objArr = objArr.filter(u => {
                    const outRole = u.roles.find(r => r.id === role.id);
                    if (!outRole) {
                        return false;
                    }
                    return true;
                });
            }
            if (options.subArgs.sort && options.subArgs.sort.toLowerCase() === "name") {
                // If they want to sort by name, do so
                objArr = objArr.sort((a, b) => a.user.toLowerCase() > b.user.toLowerCase() ? 1 : -1);
            } else {
                // Otherwise, sort by how recently they've been on
                objArr = objArr.sort((a, b) => b.time - a.time);
            }
            // If there's no one left after filtering everyone out, let em know
            if (!objArr.length) return super.error(message, "No one matches your criteria", {title: "No Match"});
            // Convert the time from a unix-format time string into something human readable
            objArr = objArr.map(u => {
                u.time = moment.duration(moment().diff(moment(u.time))).format("d [days], hh [hrs], mm [min]");
                return u;
            });

            // Limit it to 50 people if there are more
            if (objArr.length > 50) {
                objArr = objArr.slice(0, 50);
            }

            // Format the output into a table so it looks nice
            const outArr = Bot.makeTable({
                user: {value: "User", startWith: "`", endWith: "|", align: "left"},
                time: {value: "Last Seen", endWith: "`", align: "right"}
            }, objArr);

            const fields = Bot.msgArray(outArr, "\n", 700).map(m => {
                return {name: "-", value: m};
            });

            return message.channel.send({embed: {
                author: {name: message.guild.name + "'s activity log"},
                fields: fields,
                color: 0x00FF00
            }});
        } else {
            // Make sure it's a valid userID
            if (!Bot.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
            userID = Bot.getUserID(userID);
            console.log(userID);
            // Try and check the activity for just one user
            if (activityLog.log[userID]) {
                // Spit out user's last activity
                const lastActive = activityLog.log[userID];
                const diff = moment().diff(moment(lastActive));

                if ((diff / 1000 / 60) > 1) {
                    // If they've not been active for over a minute
                    return super.error(message, `User was last active ${moment.duration(diff).format("d [days], h [hrs], m [min]")} ago`, {title: "Success", color: 0x00FF00});
                } else {
                    // If they were just active
                    return super.error(message, "User was last active just a bit ago", {title: "Success", color: 0x00FF00});
                }
            } else {
                return super.error(message, "That user has not been active on this server");
            }
        }
    }
}

module.exports = CheckAct;
