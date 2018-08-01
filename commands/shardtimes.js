const momentTZ = require('moment-timezone');
require('moment-duration-format');
// const {inspect} = require('util');
const Command = require('../base/Command');

class Shardtimes extends Command {
    constructor(client) {
        super(client, {
            name: 'shardtimes',
            aliases: ['shard', 'st', 'payout', 'po'],
            guildOnly: true,
            category: 'Misc'
        });
    }

    async run(client, message, args, options) {
        const level = options.level;
        // Shard ID will be guild.id-channel.id
        const shardID = `${message.guild.id}-${message.channel.id}`;

        const exists = await client.database.models.shardtimes.findOne({where: {id: shardID}})
            .then(token => token != null)
            .then(isUnique => isUnique);

        let shardTimes = {};

        if (!exists) {
            await client.database.models.shardtimes.create({
                id: shardID,
                times: shardTimes
            });
        } else {
            const tempT = await client.database.models.shardtimes.findOne({where: {id: shardID}});
            shardTimes = tempT.dataValues.times;
        }

        let timeToAdd = 18;
        if (args.includes('-ship')) {
            args.splice(args.indexOf('-ship'), 1);
            timeToAdd = 19;
        }
        
        let [action, userID, timezone, ...flag] = args;  // eslint-disable-line prefer-const 

        if (action === 'add') {
            // If it's an admin, let them register other users, else let em register themselves
            // To add someone ;shardinfo <me|@mention|discordID> <timezone> [flag/emoji]
            let type = 'id';
            if (userID === 'me') {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                userID = userID.replace(/[^\d]*/g, '');
            } else {
                type = 'name';
            }
            if (userID !== message.author.id && userID !== message.author.username && level < 3) {
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_MISSING_PERMS'));
            }
            
            if (!timezone) {
                // Grumble that they need a timezone, then give the wiki list
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_MISSING_TIMEZONE'));
            } else {
                if (!momentTZ.tz.zone(timezone)) { // Valid time zone?
                    // Grumble that it's an invalid tz
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_INVALID_TIMEZONE'));
                } 
            }
            if (flag.length > 0) {
                flag = flag[0];
                if (flag.match(/<:.+:\d+>/)) {
                    flag = flag.replace(/<:.*:/, '').replace(/>$/, '');
                }
            } else {
                flag = '';
            }
            let tempUser = null;
            if (exists && shardTimes[`${userID}`]) {
                tempUser = shardTimes[`${userID}`];
            }
            shardTimes[`${userID}`] = {
                "type": type,
                "timezone": timezone,
                "flag": flag
            };
            await client.database.models.shardtimes.update({times: shardTimes}, {where: {id: shardID}})
                .then(() => {
                    if (tempUser) {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_USER_MOVED', tempUser.timezone, shardTimes[`${userID}`].timezone));
                    }
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_USER_ADDED'));
                })
                .catch(() => {
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_USER_NOT_ADDED'));
                });
        } else if (action === 'remove' || action === 'rem') {
            // Get the json object, remove the user if available, then resave if it changed
            if (userID !== message.author.id && userID !== message.author.username && level < 3) {
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_MISSING_PERMS'));
            }
            if (userID === 'me') {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                // If they are trying to remove someone else and they don't have the right perms, stop em
                userID = userID.replace(/[\\|<|@|!]*(\d{17,18})[>]*/g,'$1');
            } 
            if (shardTimes.hasOwnProperty(userID)) {
                delete shardTimes[userID];
                await client.database.models.shardtimes.update({times: shardTimes}, {where: {id: shardID}})
                    .then(() => {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_SUCCESS'));
                    })
                    .catch(() => {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_FAIL'));
                    });
            } else {
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_MISSING'));
            }
        } else {
            // View the shard table
            const shardOut = {};
            Object.keys(shardTimes).forEach(user => {
                const diff = timeTil(shardTimes[user].timezone, timeToAdd);
                if (shardOut.hasOwnProperty(diff)) {
                    shardOut[diff].push(user);
                } else {
                    shardOut[diff] = [user];
                }
            });

            const sortedShardTimes = Object.keys(shardOut).sort((a, b) => momentTZ(a, 'HH:mm').diff(momentTZ(b, 'HH:mm')));

            const fields = [];
            sortedShardTimes.forEach(time => {
                const times = [];
                shardOut[time].forEach(user => {
                    let userFlag = client.emojis.get(shardTimes[user].flag);
                    if (!userFlag) {
                        userFlag = shardTimes[user].flag;
                    }
                    const maxLen = 20;
                    let uName = 'Unknown';
                    if (!shardTimes[user].type || shardTimes[user].type === 'id') {
                        const thisUser = message.guild.members.get(user);
                        const userName = thisUser ? `${thisUser.displayName}` : `${client.users.get(user) ? client.users.get(user).username : 'Unknown'}`;
                        uName = '**' + (userName.length > maxLen ? userName.substring(0, maxLen) : userName) + '**';
                    } else {
                        // Type is name, don't try looking it up
                        const userName = user;
                        uName = userName.length > maxLen ? userName.substring(0, maxLen) : userName;
                    }
                    times.push(`${shardTimes[user].flag != '' ? userFlag : ""}${uName}`);
                });
                fields.push({
                    "name": time,
                    value: times.join('\n'),
                    "inline": true
                });
            });
            return message.channel.send({
                embed: {
                    "author": {
                        "name": message.language.get('COMMAND_SHARDTIMES_SHARD_HEADER')
                    },
                    "fields": fields
                }
            });
        }

        function timeTil(zone, timeToAdd) {
            let targetTime;
            if (momentTZ.tz(zone).unix() < momentTZ.tz(zone).startOf("day").add(timeToAdd, 'h').unix()) {
                // If it's later today
                targetTime = momentTZ.tz(zone).startOf("day").add(timeToAdd, 'h');
            } else {
                // If it's already passed for the day
                targetTime = momentTZ.tz(zone).startOf("day").add(1, 'd').add(timeToAdd, 'h');
            }
            return momentTZ.duration(targetTime.diff(momentTZ.tz(zone))).format('HH:mm', { trim: false });
        }
    }
}

module.exports = Shardtimes;











