const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Shardtimes extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "shardtimes",
            guildOnly: false,
            options: [
                // Add
                //  - UserID, name, me
                //  - Timezone, how long until
                //  - Flag, emote, symbol
                {
                    name: "add",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Add a new name/ user to be shown",
                    options: [
                        {
                            name: "user",
                            type: ApplicationCommandOptionType.String,
                            description: "A name or mention/ userID",
                            required: true
                        },
                        {
                            name: "timezone",
                            type: ApplicationCommandOptionType.String,
                            description: "A timezone identifyer (Ex: US/Pacific)"
                        },
                        {
                            name: "time_until",
                            type: ApplicationCommandOptionType.String,
                            description: "How long (hh:mm) until the payout"
                        },
                        {
                            name: "flag",
                            type: ApplicationCommandOptionType.String,
                            description: "An emote to show next to the name"
                        }
                    ]
                },
                // Remove
                //  - UserID, name, etc
                {
                    name: "remove",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Remove a name/ user from the list",
                    options: [
                        {
                            name: "user",
                            type: ApplicationCommandOptionType.String,
                            description: "A name or mention/ userID",
                            required: true
                        }
                    ]
                },
                // Copy (Make sure they have the correct perms for this, to avoid overwriting stuff in other channels?)
                //  - destinationChannel
                {
                    name: "copy",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Copy the shard times from this channel to the target channel",
                    options: [
                        {
                            name: "dest_channel",
                            type: ApplicationCommandOptionType.Channel,
                            description: "The channel you want it to be copied to",
                            required: true
                        }
                    ]
                },
                // View
                //  - Ships
                {
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Copy the shard times from this channel to the target channel",
                    options: [
                        {
                            name: "ships",
                            type: ApplicationCommandOptionType.Boolean,
                            description: "Show the ship arena payout times instead"
                        }
                    ]
                },
            ]
        });
    }

    async run(Bot, interaction, options) {
        // Shard ID will be guild.id-channel.id
        const shardID = `${interaction.guild.id}-${interaction.channel.id}`;

        let shardTimes = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: shardID})
            .then(st => {
                return st[0];
            });


        if (!shardTimes) {
            shardTimes = await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: shardID}, {
                id: shardID,
                times: {}
            });
        }

        const action = interaction.options.getSubcommand();

        if (action === "add") {
            // If it's an admin, let them register other users, else let em register themselves
            // To add someone ;shardinfo <me|@mention|discordID> <timezone> [flag/emoji]
            let userID     = interaction.options.getString("user");
            let flag       = interaction.options.getString("flag");
            let timezone = interaction.options.getString("timezone");
            const timeTil  = interaction.options.getString("time_until");

            let type = "id";
            if (userID === "me") {
                userID = interaction.user.id;
            } else if (Bot.isUserID(userID)) {
                // If it's an ID, use it as such
                userID = userID.replace(/[^\d]*/g, "");
            } else {
                // Otherwise, use it as a name
                type = "name";
            }

            let zoneType = "zone";
            let tempZone = timezone ? timezone : null;

            // If they're trying to add someone other than themselves, make sure they have perms for it (AdminRole/ server manager)
            if ([interaction.user.id, interaction.user.username, "me"].includes(userID) && options.level < Bot.constants.GUILD_ADMIN) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
            }

            if (timezone && timeTil) {
                // Warn em if they try using both a timezone and the time_until, since they can only use one
                return super.error(interaction, "You may not use both **timezone** and **time_until**, please choose one or the other");
            } else if (!timezone && !timeTil) {
                // Warn em if they don't give a timezone or time_until
                return super.error(interaction, "You need to specify when the user's payout will be, using either the **timezone** or **time_until** arguments");
            }


            if (timezone) {
                const match = timezone.match(/([+-])(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                if (Bot.isValidZone(timezone)) {
                    // Timezone is fine & already set, continue on
                } else if (match) {
                    // It's a UTC +/- zone  (+8:00 / -4:15)
                    zoneType = "utc";
                    timezone = parseInt(`${match[1]}${(match[2] * 60) + parseInt(match[3], 10)}`, 10);
                } else {
                    // Grumble that it's an invalid tz
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_INVALID_TIMEZONE"));
                }
            } else {
                zoneType = "hhmm";
                const match = timeTil.match(/(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                if (!match) {
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_INVALID_TIME_TIL"));
                }
                // Get the amount of time til, and split it into hr & min
                const [hour, minute] = timeTil.split(":");

                // Then grab the current UTC time, and add the hr & min onto that
                const nowTime = new Date();
                const hourMS  = 60*60*1000;
                const minMS   = 60*1000;
                const updatedTime = new Date().setTime(nowTime.getTime() + (hour*hourMS) + (minute*minMS));
                const tempH = updatedTime.getHours();
                const tempM = updatedTime.getMinutes();

                const totalMin = (tempH * 60) + tempM;
                const rounded = Math.round(totalMin / 15) * 15;
                timezone = `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padEnd(2, "0")}`;
                tempZone = timezone + " UTC";
            }
            if (flag) {
                if (flag.match(/<:.+:\d+>/)) {
                    flag = flag.replace(/<:.*:/, "").replace(/>$/, "");
                }
            } else {
                flag = "";
            }
            let tempUser = null;
            if (shardTimes.times[`${userID}`]) {
                tempUser = shardTimes.times[`${userID}`];
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
            shardTimes.times[`${userID}`] = {
                "type": type,
                "zoneType": zoneType,
                "timezone": timezone,
                "flag": flag
            };
            await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: shardID}, shardTimes)
                .then(() => {
                    if (tempUser) {
                        return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_USER_MOVED", tempUser.tempZone, tempZone)});
                    }
                    return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_USER_ADDED")});
                })
                .catch(() => {
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_USER_NOT_ADDED"));
                });
        } else if (action === "remove") {
            // Get the json object, remove the user if available, then resave if it changed

            let userID = interaction.options.getString("user");
            if (userID === "me") {
                userID = interaction.user.id;
            } else if (Bot.isUserID(userID)) {
                // If it's an ID, use it as such
                userID = userID.replace(/[^\d]*/g, "");
            }

            // If they're trying to add someone other than themselves, make sure they have perms for it (AdminRole/ server manager)
            if ([interaction.user.id, interaction.user.username, "me"].includes(userID) && options.level < Bot.constants.GUILD_ADMIN) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
            }

            if (shardTimes.times[userID]) {
                delete shardTimes.times[userID];
                await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: shardID}, shardTimes)
                    .then(() => {
                        return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_REM_SUCCESS")});
                    })
                    .catch(() => {
                        return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_REM_FAIL"));
                    });
            } else {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_REM_MISSING"));
            }
        } else if (action === "copy") {  // ;shardtimes copy destChannel
            const destChannel = interaction.options.getChannel("dest_channel");

            // Make sure the person has the correct perms to copy it (admin/ mod)
            if (options.level < Bot.consants.GUILD_ADMIN) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to do this
                return super.error(interaction, interaction.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }

            // Make sure there are times to copy from
            if (!Object.keys(shardTimes).length) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_NO_SOURCE"));
            }

            // Check and make sure the bot has permissions to see/ send in the specified channel
            if (Bot.hasViewAndSend(destChannel, interaction.guild.members.me)) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_NO_PERMS", destChannel.id));
            }

            // Make sure the to/ from channels aren't the same
            if (interaction.channel.id === destChannel.id) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_SAME_CHAN"));
            }

            const destShardID = `${interaction.guild.id}-${destChannel.id}`;

            const destExists = await Bot.cache.exists(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: destShardID});

            if (!destExists) {
                // If there's no shard info in the destination channel
                await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: shardID, times: shardTimes})
                    .then(() => {
                        return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChannel.id)});
                    })
                    .catch((err) => {
                        return super.error(interaction, err.message);
                    });
            } else {
                const thisShardTimes = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: destShardID});
                const destHasTimes = thisShardTimes[0]?.times.length;
                if (destHasTimes) {
                    // Of if there is shard info there with listings
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_DEST_FULL"));
                } else {
                    // Or if there is shard info there, but no listings
                    await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "shardtimes", {id: destShardID}, shardTimes)
                        .then(() => {
                            return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChannel.id)});
                        })
                        .catch(() => {
                            return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_BROKE"));
                        });
                }
            }
            return;
        } else if (action === "view") {
            const isShip = interaction.options.getBoolean("ships");

            // View the shard table
            const timeToAdd = isShip ? 19 : 18;
            const shardOut = {};

            if (!shardTimes?.times || !Object.keys(shardTimes.times)?.length) {
                return super.error(interaction, "Sorry, but it looks like you don't have anyone registered to watch");
            }

            Object.keys(shardTimes.times).forEach(user => {
                const diff = timeTil(shardTimes.times[user].timezone, timeToAdd, (shardTimes.times[user]?.zoneType ? shardTimes.times[user].zoneType : "zone"));
                if (shardOut[diff]) {
                    shardOut[diff].push(user);
                } else {
                    shardOut[diff] = [user];
                }
            });

            const sortedShardTimes = Object.keys(shardOut).sort((a, b) => a > b ? 1 : -1);

            const fields = [];
            for (const time of sortedShardTimes) {
                const times = [];
                for (const user of shardOut[time]) {
                    let userFlag = interaction.client.emojis.cache.get(shardTimes.times[user].flag);
                    if (!userFlag) {
                        userFlag = shardTimes.times[user].flag;
                    }
                    const maxLen = 20;
                    let uName = "";
                    if (!shardTimes.times[user].type || shardTimes.times[user].type === "id") {
                        const thisUser = await interaction.guild.members.fetch(user).catch(() => {});
                        const userName = thisUser ? thisUser.displayName : user;
                        uName = "**" + (userName.length > maxLen ? userName.substring(0, maxLen) : userName) + "**";
                    } else {
                        // Type is name, don't try looking it up
                        const userName = user;
                        uName = userName.length > maxLen ? userName.substring(0, maxLen) : userName;
                    }
                    times.push({
                        flag: shardTimes.times[user].flag != "" ? userFlag : "",
                        name: uName
                    });
                }
                const sortedTimes = times.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0).map(t => `${t.flag}${t.name}`);
                let joiner = " - ";
                if (interaction.guildSettings.shardtimeVertical) {
                    joiner = "\n";
                }
                fields.push({
                    name: time,
                    value: sortedTimes.join(joiner)
                });
            }
            return interaction.reply({
                embeds: [{
                    "author": {
                        "name": interaction.language.get("COMMAND_SHARDTIMES_SHARD_HEADER")
                    },
                    "fields": fields
                }]
            });
        }

        function timeTil(zone, timeToAdd, type) {
            const hrMS = 1000 * 60 * 60;
            const dayMS = 1000 * 60 * 60 * 24;
            const nowTime = new Date().getTime();
            let targetTime;
            if (type === "zone") {
                const target = (Bot.getStartOfDay(zone)).getTime() + (hrMS * timeToAdd);
                targetTime = (target + nowTime) > target ? target : target + dayMS;
            } else if (type === "hhmm") {
                const target = getUTCAtTime(zone);
                if (target < nowTime) {
                    // It's already passed
                    targetTime = target + dayMS;
                } else {
                    targetTime = target;
                }
            } else {
                const target = Bot.getUTCFromOffset(zone) + (hrMS * timeToAdd);
                if (target < nowTime) {
                    // It's already passed
                    targetTime = target + dayMS;
                } else {
                    targetTime = target;
                }
            }
            const times = Bot.convertMS(targetTime - new Date().getTime());
            return times.hour.toString().padStart(2, "0") + ":" + times.minute.toString().padStart(2, "0");
        }


        function getUTCAtTime(hhmm) {
            const [hr, min] = hhmm.split(":").map(t => parseInt(t, 10));
            const nowDate = new Date();
            return Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hr, min);
        }

    }
}

module.exports = Shardtimes;
