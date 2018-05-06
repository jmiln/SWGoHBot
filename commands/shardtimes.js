const momentTZ = require('moment-timezone');
require('moment-duration-format');
// const {inspect} = require('util');
const Command = require('../base/Command');


exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['shard'],
    permLevel: 0,
    permissions: ['EMBED_LINKS']
};

exports.help = {
    name: 'shardtimes',
    category: 'Misc',
    description: 'Lists the time til payout of anyone registered.',
    usage: `shardtimes add <me|userID|mention> <timezone> [flag/emoji]
;shardtimes remove <me|userID|mention>
;shardtimes [view]`,
    example: `;shardtimes`,
    extended: `\`\`\`asciidoc
add     - Add a user to the list of names
remove  - Remove a user from the list
view    - View the list. Also works with no arg.\`\`\``
};


class Shardtimes extends Command {
    constructor(client) {
        super(client, {
            name: 'shardtimes',
            aliases: ['shard', 'payout'],
            guildOnly: true,
            category: 'Misc'
        });
    }

    async run(client, message, args, options) {
        const level = options.level;
        // DB ID will be guild.id-channel.id
        const shardID = `${message.guild.id}-${message.channel.id}`;

        const exists = await client.shardTimes.findOne({where: {id: shardID}})
            .then(token => token != null)
            .then(isUnique => isUnique);

        let shardTimes = {};

        if (!exists) {
            await client.shardTimes.create({
                id: shardID,
                times: shardTimes
            });
        } else {
            const tempT = await client.shardTimes.findOne({where: {id: shardID}});
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
            if (!userID) {
                // Send the message with all the times (Closest first)
                return message.channel.send(message.language.get('COMMAND_SHARDTIMES_MISSING_USER'));
            } else { 
                if (userID === 'me') {
                    userID = message.author.id;
                } else if (userID.match(/\d{17,18}/)) {
                    userID = userID.replace(/[^\d]*/g, '');
                    // If they are trying to add someone else and they don't have the right perms, stop em
                    if (userID !== message.author.id && level < 3) {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_MISSING_ROLE'));
                    }
                } else {
                    // Bad name, grumblin time
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_INVALID_USER'));
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
                
                shardTimes[`${userID}`] = {
                    "timezone": timezone,
                    "flag": flag
                };
                await client.shardTimes.update({times: shardTimes}, {where: {id: shardID}})
                    .then(() => {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_USER_ADDED'));
                    })
                    .catch(() => {
                        return message.channel.send(message.language.get('COMMAND_SHARDTIMES_USER_NOT_ADDED'));
                    });
            }
        } else if (action === 'remove' || action === 'rem') {
            // Get the json object, remove the user if available, then resave if it changed
            if (userID === 'me') {
                userID = message.author.id;
            } else if (userID.match(/\d{17,18}/)) {
                userID = userID.replace(/[\\|<|@|!]*(\d{17,18})[>]*/g,'$1');
                // If they are trying to remove someone else and they don't have the right perms, stop em
                if (userID !== message.author.id && level < 3) {
                    return message.channel.send(message.language.get('COMMAND_SHARDTIMES_REM_MISSING_PERMS'));
                }
            } 
            if (shardTimes.hasOwnProperty(userID)) {
                delete shardTimes[userID];
                await client.shardTimes.update({times: shardTimes}, {where: {id: shardID}})
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
                    const thisUser = message.guild.members.get(user);
                    const userName = thisUser ? `${thisUser.displayName}` : `${client.users.get(user) ? client.users.get(user).username : 'Unknown'}`;
                    const uName = userName.length > maxLen ? userName.substring(0, maxLen) : userName;
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











