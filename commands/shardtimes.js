const momentTZ = require("moment-timezone");
require("moment-duration-format");
// const {inspect} = require('util');
const Command = require("../base/Command");

class Shardtimes extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "shardtimes",
            aliases: ["shard", "st", "payout", "po"],
            guildOnly: true,
            category: "Misc",
            permissions: ["EMBED_LINKS"],
            flags: {
                "ships": {
                    aliases: ["ship", "s"]
                }
            },
            subArgs: {
                "timeuntil": {
                    aliases: ["tu"]
                }
            }
        });
    }

    async run(Bot, message, [action, userID, timezone, ...flag], options) {
        const level = options.level;
        // Shard ID will be guild.id-channel.id
        const shardID = `${message.guild.id}-${message.channel.id}`;

        const exists = await Bot.database.models.shardtimes.findOne({where: {id: shardID}})
            .then(token => token != null)
            .then(isUnique => isUnique);

        let shardTimes = {};

        if (!exists) {
            await Bot.database.models.shardtimes.create({
                id: shardID,
                times: shardTimes
            });
        } else {
            const tempT = await Bot.database.models.shardtimes.findOne({where: {id: shardID}});
            shardTimes = tempT.dataValues.times;
        }

        let timeToAdd = 18;
        if (options.flags.ships) {
            timeToAdd = 19;
        }

        if (action === "add") {
            // If it's an admin, let them register other users, else let em register themselves
            // To add someone ;shardinfo <me|@mention|discordID> <timezone> [flag/emoji]
            let type = "id", zoneType = "zone";
            let tempZone = timezone ? timezone : null;
            if (userID === "me") {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                userID = userID.replace(/[^\d]*/g, "");
            } else {
                type = "name";
            }
            if (userID !== message.author.id && userID !== message.author.username && level < 3) {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
            }
            if (!options.subArgs.timeuntil) {
                if (!timezone) {
                    // Grumble that they need a timezone, then give the wiki list
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_MISSING_TIMEZONE"));
                } else {
                    if (!momentTZ.tz.zone(timezone)) { // Valid time zone?
                        const match = timezone.match(/([+-])(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                        if (match) {
                            // It's a UTC +/- zone
                            zoneType = "utc";
                            timezone = parseInt(`${match[1]}${parseInt(match[2] * 60, 10) + parseInt(match[3], 10)}`, 10);
                        } else {
                            // Grumble that it's an invalid tz
                            return super.error(message, message.language.get("COMMAND_SHARDTIMES_INVALID_TIMEZONE"));
                        }
                    }
                }
            } else {
                flag = timezone ? [timezone] : [];
                zoneType = "hhmm";
                const timeTil = options.subArgs.timeuntil;
                const match = timeTil.match(/(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                if (match) {
                    // It's a valid time until payout
                    const [hour, minute] = timeTil.split(":");
                    const [tempH, tempM] = momentTZ.tz("UTC").add(hour, "h").add(minute, "m").format("HH:mm").split(":").map(t => parseInt(t, 10));
                    const totalMin = (tempH * 60) + tempM;
                    const rounded = Math.round(totalMin / 15) * 15;
                    timezone = `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padEnd(2, "0")}`;
                    tempZone = timezone + " UTC";
                } else {
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_INVALID_TIME_TIL"));
                }
            }
            if (flag.length > 0) {
                flag = flag[0];
                if (flag.match(/<:.+:\d+>/)) {
                    flag = flag.replace(/<:.*:/, "").replace(/>$/, "");
                }
            } else {
                flag = "";
            }
            let tempUser = null;
            if (exists && shardTimes[`${userID}`]) {
                tempUser = shardTimes[`${userID}`];
                if (tempUser.zoneType) {
                    if (tempUser.zoneType === "utc") {
                        const sign = tempUser.timezone >= 0 ? "+" : "-";
                        const num = Math.abs(tempUser.timezone);
                        const hour = Math.floor(num / 60);
                        let min = (num % 60).toString();
                        if (min.length === 1) min = "0" + min;
                        tempUser.tempZone = sign + hour + ":" + min;
                    } else if (tempUser.zoneType === "hhmm") {
                        tempUser.tempZone = tempUser.timezone + " UTC";
                    } else if (tempUser.zoneType === "zone") {
                        tempUser.tempZone = tempUser.timezone;
                    }
                } else {
                    tempUser.tempZone = tempUser.timezone;
                }
            }
            shardTimes[`${userID}`] = {
                "type": type,
                "zoneType": zoneType,
                "timezone": timezone,
                "flag": flag
            };
            await Bot.database.models.shardtimes.update({times: shardTimes}, {where: {id: shardID}})
                .then(() => {
                    if (tempUser) {
                        return message.channel.send({content: message.language.get("COMMAND_SHARDTIMES_USER_MOVED", tempUser.tempZone, tempZone)});
                    }
                    return message.channel.send({content: message.language.get("COMMAND_SHARDTIMES_USER_ADDED")});
                })
                .catch(() => {
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_USER_NOT_ADDED"));
                });
        } else if (action === "remove" || action === "rem") {
            // Get the json object, remove the user if available, then resave if it changed
            if (userID !== message.author.id && userID !== message.author.username && level < 3) {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
            }
            if (userID === "me") {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                // If they are trying to remove someone else and they don't have the right perms, stop em
                userID = userID.replace(/[\\|<|@|!]*(\d{17,18})[>]*/g,"$1");
            }
            if (shardTimes[userID]) {
                delete shardTimes[userID];
                await Bot.database.models.shardtimes.update({times: shardTimes}, {where: {id: shardID}})
                    .then(() => {
                        return message.channel.send({content: message.language.get("COMMAND_SHARDTIMES_REM_SUCCESS")});
                    })
                    .catch(() => {
                        return super.error(message, message.language.get("COMMAND_SHARDTIMES_REM_FAIL"));
                    });
            } else {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_REM_MISSING"));
            }
        } else if (action === "copy") {  // ;shardtimes copy destChannel
            // Make sure the person has the correct perms to copy it (admin/ mod)
            if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to do this
                return super.error(message, message.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }
            // Make sure there are times to copy from
            if (!Object.keys(shardTimes).length) {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_NO_SOURCE"));
            }
            // Check and make sure the destination channel exists/ the bot has permissions to see/ send there
            let destChan = message.guild.channels.cache.find(c => c.name === userID);
            if (!destChan) {
                destChan = message.guild.channels.cache.get(userID.replace(/[^0-9]/g, ""));
                if (!destChan) {
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_NO_DEST", userID));
                }
            }
            if (!destChan.permissionsFor(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_NO_PERMS", destChan.id));
            }

            if (message.channel.id === destChan.id) {
                return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_SAME_CHAN"));
            }

            const destShardID = `${message.guild.id}-${destChan.id}`;

            const destExists = await Bot.database.models.shardtimes.findOne({where: {id: destShardID}})
                .then(token => token != null)
                .then(isUnique => isUnique);

            if (!destExists) {
                // If there's no shard info in the destination channel
                await Bot.database.models.shardtimes.create({ id: destShardID, times: shardTimes })
                    .then(() => {
                        return message.channel.send({content: message.language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChan.id)});
                    })
                    .catch((err) => {
                        return super.error(message, err.message);
                    });
            } else {
                const destHasTimes = await Bot.database.models.shardtimes.findOne({where: {id: destShardID}})
                    .then(times => Object.keys(times.dataValues.times).length)
                    .then(isLen => isLen);
                if (destHasTimes) {
                    // Of if there is shard info there with listings
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_DEST_FULL"));
                } else {
                    // Or if there is shard info there, but no listings
                    await Bot.database.models.shardtimes.update({times: shardTimes}, {where: {id: destShardID}})
                        .then(() => {
                            return message.channel.send({content: message.language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChan.id)});
                        })
                        .catch(() => {
                            return super.error(message, message.language.get("COMMAND_SHARDTIMES_COPY_BROKE"));
                        });
                }
            }
            return;
        } else {
            // View the shard table
            const shardOut = {};
            Object.keys(shardTimes).forEach(user => {
                const diff = timeTil(shardTimes[user].timezone, timeToAdd, (shardTimes[user].zoneType ? shardTimes[user].zoneType : "zone"));
                if (shardOut[diff]) {
                    shardOut[diff].push(user);
                } else {
                    shardOut[diff] = [user];
                }
            });

            const sortedShardTimes = Object.keys(shardOut).sort((a, b) => momentTZ(a, "HH:mm").diff(momentTZ(b, "HH:mm")));

            const fields = [];
            for (const time of sortedShardTimes) {
                const times = [];
                for (const user of shardOut[time]) {
                    let userFlag = message.client.emojis.cache.get(shardTimes[user].flag);
                    if (!userFlag) {
                        userFlag = shardTimes[user].flag;
                    }
                    const maxLen = 20;
                    let uName = "";
                    if (!shardTimes[user].type || shardTimes[user].type === "id") {
                        const thisUser = await message.guild.members.fetch(user).catch(() => {});
                        const userName = thisUser ? thisUser.displayName : user;
                        uName = "**" + (userName.length > maxLen ? userName.substring(0, maxLen) : userName) + "**";
                    } else {
                        // Type is name, don't try looking it up
                        const userName = user;
                        uName = userName.length > maxLen ? userName.substring(0, maxLen) : userName;
                    }
                    times.push({
                        flag: shardTimes[user].flag != "" ? userFlag : "",
                        name: uName
                    });
                }
                const sortedTimes = times.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0).map(t => `${t.flag}${t.name}`);
                let joiner = " - ";
                if (message.guildSettings.shardtimeVertical) {
                    joiner = "\n";
                }
                fields.push({
                    name: time,
                    value: sortedTimes.join(joiner)
                });
            }
            return message.channel.send({
                embeds: [{
                    "author": {
                        "name": message.language.get("COMMAND_SHARDTIMES_SHARD_HEADER")
                    },
                    "fields": fields
                }
            }]);
        }

        function timeTil(zone, timeToAdd, type) {
            let targetTime;
            if (type === "zone") {
                if (momentTZ.tz(zone).unix() < momentTZ.tz(zone).startOf("day").add(timeToAdd, "h").unix()) {
                    // If it's later today
                    targetTime = momentTZ.tz(zone).startOf("day").add(timeToAdd, "h");
                } else {
                    // If it's already passed for the day
                    targetTime = momentTZ.tz(zone).startOf("day").add(1, "d").add(timeToAdd, "h");
                }
            } else if (type === "hhmm") {
                if (momentTZ.tz(zone, "HH:mm", "UTC").unix() < momentTZ().unix()) {
                    // It's already passed
                    return momentTZ.duration(momentTZ.tz(zone, "HH:mm", "UTC").add(1, "d").diff(momentTZ())).format("HH:mm", { trim: false });
                }
                return momentTZ.duration(momentTZ.tz(zone, "HH:mm", "UTC").diff(momentTZ())).format("HH:mm", { trim: false });
            } else {
                // It's utc +/- format
                if (momentTZ().utcOffset(zone).unix() < momentTZ().utcOffset(zone).startOf("day").add(timeToAdd, "h").unix()) {
                    targetTime = momentTZ().utcOffset(zone).startOf("day").add(timeToAdd, "h");
                } else {
                    targetTime = momentTZ().utcOffset(zone).startOf("day").add(1, "d").add(timeToAdd, "h");
                }
                return momentTZ.duration(targetTime.diff(momentTZ().utcOffset(zone))).format("HH:mm", { trim: false });
            }
            return momentTZ.duration(targetTime.diff(momentTZ.tz(zone))).format("HH:mm", { trim: false });
        }
    }
}

module.exports = Shardtimes;
