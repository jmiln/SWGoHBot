import { Interaction, TextChannel } from "discord.js";
import moment from "moment-timezone";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType, CommandOptions } from "../modules/types";

class Shardtimes extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "shardtimes",
            guildOnly: false,
            category: "Misc",
            permissions: ["EMBED_LINKS"],
            options: [
                // Add
                //  - UserID, name, me
                //  - Timezone, how long until
                //  - Flag, emote, symbol
                {
                    name: "add",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Add a new name/ user to be shown",
                    options: [
                        {
                            name: "user",
                            type: Bot.constants.optionType.STRING,
                            description: "A name or mention/ userID",
                            required: true
                        },
                        {
                            name: "timezone",
                            type: Bot.constants.optionType.STRING,
                            description: "A timezone identifyer (Ex: US/Pacific)"
                        },
                        {
                            name: "time_until",
                            type: Bot.constants.optionType.STRING,
                            description: "How long (hh:mm) until the payout"
                        },
                        {
                            name: "flag",
                            type: Bot.constants.optionType.STRING,
                            description: "An emote to show next to the name"
                        }
                    ]
                },
                // Remove
                //  - UserID, name, etc
                {
                    name: "remove",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Remove a name/ user from the list",
                    options: [
                        {
                            name: "user",
                            type: Bot.constants.optionType.STRING,
                            description: "A name or mention/ userID",
                            required: true
                        }
                    ]
                },
                // Copy (Make sure they have the correct perms for this, to avoid overwriting stuff in other channels?)
                //  - destinationChannel
                {
                    name: "copy",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Copy the shard times from this channel to the target channel",
                    options: [
                        {
                            name: "dest_channel",
                            type: Bot.constants.optionType.CHANNEL,
                            description: "The channel you want it to be copied to",
                            required: true
                        }
                    ]
                },
                // View
                //  - Ships
                {
                    name: "view",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Copy the shard times from this channel to the target channel",
                    options: [
                        {
                            name: "ships",
                            type: Bot.constants.optionType.BOOLEAN,
                            description: "Show the ship arena payout times instead"
                        }
                    ]
                },
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction, options: CommandOptions) {
        const level = options.level;
        // Shard ID will be guild.id-channel.id
        const shardID = `${interaction.guild.id}-${interaction.channel.id}`;

        let exists = await Bot.database.models.shardtimes.findOne({where: {id: shardID}});

        let shardTimes = {};
        if (!exists?.dataValues) {
            await Bot.database.models.shardtimes.create({
                id: shardID,
                times: shardTimes
            });
        } else {
            exists = exists.dataValues;
            shardTimes = exists.times;
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
            if ([interaction.user.id, interaction.user.username, "me"].includes(userID) && level < 3) {
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
                if (!moment.tz.zone(timezone)) { // Valid time zone?
                    const match = timezone.match(/([+-])(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                    if (match) {
                        // It's a UTC +/- zone
                        zoneType = "utc";
                        timezone = (parseInt(`${match[1]}${parseInt(match[2], 10) * 60 + parseInt(match[3], 10)}`, 10)).toString();
                    } else {
                        // Grumble that it's an invalid tz
                        return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_INVALID_TIMEZONE"));
                    }
                }
            } else {
                zoneType = "hhmm";
                const match = timeTil.match(/(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
                if (match) {
                    // It's a valid time until payout
                    const [hour, minute] = timeTil.split(":");
                    const [tempH, tempM] = moment.tz("UTC").add(hour, "h").add(minute, "m").format("HH:mm").split(":").map((t: string) => parseInt(t, 10));
                    const totalMin = (tempH * 60) + tempM;
                    const rounded = Math.round(totalMin / 15) * 15;
                    timezone = `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padEnd(2, "0")}`;
                    tempZone = timezone + " UTC";
                } else {
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_INVALID_TIME_TIL"));
                }
            }
            if (flag) {
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
            if ([interaction.user.id, interaction.user.username, "me"].includes(userID) && level < 3) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
            }

            if (shardTimes[userID]) {
                delete shardTimes[userID];
                await Bot.database.models.shardtimes.update({times: shardTimes}, {where: {id: shardID}})
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
            const destChannel = interaction.options.getChannel("dest_channel") as TextChannel;

            // Make sure the person has the correct perms to copy it (admin/ mod)
            if (level < 3) {  // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to do this
                return super.error(interaction, interaction.language.get("COMMAND_EVENT_INVALID_PERMS"));
            }

            // Make sure there are times to copy from
            if (!Object.keys(shardTimes).length) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_NO_SOURCE"));
            }

            // Check and make sure the bot has permissions to see/ send in the specified channel
            if (!destChannel.permissionsFor(interaction.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_NO_PERMS", destChannel.id));
            }

            // Make sure the to/ from channels aren't the same
            if (interaction.channel.id === destChannel.id) {
                return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_SAME_CHAN"));
            }

            const destShardID = `${interaction.guild.id}-${destChannel.id}`;

            const destExists = await Bot.database.models.shardtimes.findOne({where: {id: destShardID}});

            if (!destExists?.dataValues) {
                // If there's no shard info in the destination channel
                await Bot.database.models.shardtimes.create({ id: destShardID, times: shardTimes })
                    .then(() => {
                        return interaction.reply({content: interaction.language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChannel.id)});
                    })
                    .catch((err: Error) => {
                        return super.error(interaction, err.message);
                    });
            } else {
                const destHasTimes = await Bot.database.models.shardtimes.findOne({where: {id: destShardID}})
                    .then((times: {dataValues: any}) => Object.keys(times.dataValues.times).length)
                    .then((isLen: any) => isLen);
                if (destHasTimes) {
                    // Of if there is shard info there with listings
                    return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_COPY_DEST_FULL"));
                } else {
                    // Or if there is shard info there, but no listings
                    await Bot.database.models.shardtimes.update({times: shardTimes}, {where: {id: destShardID}})
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
            Object.keys(shardTimes).forEach(user => {
                const diff = timeTil(shardTimes[user].timezone, timeToAdd, (shardTimes[user].zoneType ? shardTimes[user].zoneType : "zone"));
                if (shardOut[diff]) {
                    shardOut[diff].push(user);
                } else {
                    shardOut[diff] = [user];
                }
            });

            const sortedShardTimes = Object.keys(shardOut).sort((a, b) => moment(a, "HH:mm").diff(moment(b, "HH:mm")));

            const fields = [];
            for (const time of sortedShardTimes) {
                const times = [];
                for (const user of shardOut[time]) {
                    let userFlag = interaction.client.emojis.cache.get(shardTimes[user].flag);
                    if (!userFlag) {
                        userFlag = shardTimes[user].flag;
                    }
                    const maxLen = 20;
                    let uName = "";
                    if (!shardTimes[user].type || shardTimes[user].type === "id") {
                        const thisUser = await interaction.guild.members.fetch(user).catch(() => {});
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

        function timeTil(zone: string, timeToAdd: number, type: string) {
            let targetTime: any;
            if (type === "zone") {
                if (moment.tz(zone).unix() < moment.tz(zone).startOf("day").add(timeToAdd, "h").unix()) {
                    // If it's later today
                    targetTime = moment.tz(zone).startOf("day").add(timeToAdd, "h");
                } else {
                    // If it's already passed for the day
                    targetTime = moment.tz(zone).startOf("day").add(1, "d").add(timeToAdd, "h");
                }
            } else if (type === "hhmm") {
                if (moment.tz(zone, "HH:mm", "UTC").unix() < moment().unix()) {
                    // It's already passed
                    console.log("hhmm-2: " + moment.tz(zone, "HH:mm", "UTC").add(1, "d").unix(), moment().unix());
                    return Bot.duration({time: moment.tz(zone, "HH:mm", "UTC").add(1, "d").unix() - moment().unix(), interaction: interaction, type: "diff"});
                }
                console.log("hhmm: " + moment.tz(zone, "HH:mm", "UTC").unix(), moment().unix());
                return Bot.duration({time: moment.tz(zone, "HH:mm", "UTC").unix() - moment().unix(), interaction: interaction, type: "diff"});
            } else {
                // It's utc +/- format
                if (moment().utcOffset(zone).unix() < moment().utcOffset(zone).startOf("day").add(timeToAdd, "h").unix()) {
                    targetTime = moment().utcOffset(zone).startOf("day").add(timeToAdd, "h");
                } else {
                    targetTime = moment().utcOffset(zone).startOf("day").add(1, "d").add(timeToAdd, "h");
                }
                console.log("UTC: " + targetTime.unix(), moment().unix());
                return Bot.duration({time: targetTime.unix() - moment().unix(), interaction: interaction, type: "diff"});
            }
            console.log("Zone:" + targetTime.unix(), moment().unix());
            return Bot.duration({time: targetTime.unix() - moment().unix(), interaction: interaction, type: "diff"});
        }
    }
}

module.exports = Shardtimes;
