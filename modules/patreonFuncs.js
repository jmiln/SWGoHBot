const moment = require("moment-timezone");

module.exports = (Bot, client) => {
    const honPat = 500;
    // Check if a given user is a patron, and if so, return their info
    Bot.getPatronUser = async (userId) => {
        if (!userId) return new Error("Missing user ID");
        if (userId === Bot.config.ownerid || (Bot.config.patrons && Bot.config.patrons.indexOf(userId) > -1)) {
            return {discordID: userId, amount_cents: userId === Bot.config.ownerid ? 1500 : honPat};
        }
        let patron = await Bot.cache.get("swgohbot", "patrons", {discordID: userId});

        if (Array.isArray(patron)) patron = patron[0];
        if (patron && !patron.declined_since) {
            return patron;
        }
    };

    // Get an array of all active patrons
    async function getActivePatrons() {
        let patrons = await Bot.cache.get("swgohbot", "patrons", {});
        patrons = patrons.filter(p => !p.declined_since);
        const others = Bot.config.patrons ? Bot.config.patrons.concat([Bot.config.ownerid]) : [Bot.config.ownerid];
        for (const u of others) {
            const user = patrons.find(p => p.discordID === u);
            if (!user) {
                patrons.push({discordID: u, amount_cents: u === Bot.config.ownerid ? 1500 : honPat});
            }
        }
        return patrons;
    }

    // Get the cooldown
    Bot.getPlayerCooldown = async (authorID) => {
        const patron = await Bot.getPatronUser(authorID);
        if (!patron) {
            return {
                player: 2*60,
                guild:  6*60
            };
        }
        if (patron.amount_cents >= 500) {
            // If they have the $5 tier or higher, they get shorted guild & player times
            return {
                player: 60,
                guild:  3*60
            };
        } else if (patron.amount_cents >= 100) {
            // They have the $1 tier, so they get short player times
            return {
                player: 60,
                guild:  6*60
            };
        } else {
            // If they are not a patron, their cooldown is the default
            return {
                player: 2*60,
                guild:  6*60
            };
        }
    };

    // Check for updated ranks
    Bot.getRanks = async () => {
        const patrons = await getActivePatrons();
        for (const patron of patrons) {
            if (patron.amount_cents < 100) continue;
            const user = await Bot.userReg.getUser(patron.discordID);
            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.accounts.length) continue;

            // If they don't want any alerts
            if (!user.arenaAlert || user.arenaAlert.enableRankDMs === "off") continue;
            const accountsToCheck = JSON.parse(JSON.stringify(user.accounts));

            for (let ix = 0; ix < accountsToCheck.length; ix++) {
                const acc = accountsToCheck[ix];
                // If the user only has em enabled for the primary ac, ignore the rest
                if (((user.accounts.length > 1 && patron.amount_cents < 500) || user.arenaAlert.enableRankDMs === "primary") && !acc.primary) {
                    continue;
                }
                let player;
                try {
                    player = await Bot.swgohAPI.getPlayersArena(acc.allyCode);
                    if (Array.isArray(player)) player = player[0];
                    // player = await Bot.swgohAPI.fastPlayer(acc.allyCode);
                } catch (e) {
                    // Wait since it won't happen later when something breaks
                    await Bot.wait(750);
                    return Bot.logger.error("Broke in getRanks: " + e);
                }
                if (!acc.lastCharRank) {
                    acc.lastCharRank = 0;
                    acc.lastCharClimb = 0;
                }
                if (!acc.lastShipRank) {
                    acc.lastShipRank = 0;
                    acc.lastShipClimb = 0;
                }
                const now = moment();
                if (!user.arenaAlert.arena) user.arenaAlert.arena = "none";
                if (!user.arenaAlert.payoutWarning) user.arenaAlert.payoutWarning = 0;
                if (!player || !player.arena) continue;

                if (player.arena.char && player.arena.char.rank) {
                    if (["both", "char"].includes(user.arenaAlert.arena)) {
                        let then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").subtract(6, "h");
                        if (then.unix() < now.unix()) {
                            then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").add(18, "h");
                        }
                        const minTil =  parseInt((then-now)/60/1000, 10);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";

                        const pUser = await client.users.fetch(patron.discordID);
                        if (pUser) {
                            try {
                                if (user.arenaAlert.payoutWarning > 0) {
                                    if (user.arenaAlert.payoutWarning  === minTil) {
                                        pUser.send({embed: {
                                            author: {name: "Arena Payout Alert"},
                                            description: `${player.name}'s character arena payout is in **${minTil}** minutes!\nYour current rank is ${player.arena.char.rank}`,
                                            color: "#00FF00"
                                        }});
                                    }
                                }
                                if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                    pUser.send({embed: {
                                        author: {name: "Character arena"},
                                        description: `${player.name}'s payout ended at **${player.arena.char.rank}**!`,
                                        color: "#00FF00"
                                    }});
                                }

                                if (player.arena.char.rank > acc.lastCharRank) {
                                    // DM user that they dropped
                                    pUser.send({embed: {
                                        author: {name: "Character Arena"},
                                        description: `**${player.name}'s** rank just dropped from ${acc.lastCharRank} to **${player.arena.char.rank}**\nDown by **${player.arena.char.rank - acc.lastCharClimb}** since last climb`,
                                        color: "#ff0000",
                                        footer: {
                                            text: payoutTime
                                        }
                                    }});
                                }
                            } catch (e) {
                                Bot.logger.error("Broke getting ranks: " + e);
                            }
                        }
                    }
                    acc.lastCharClimb = acc.lastCharClimb ? (player.arena.char.rank < acc.lastCharRank ? player.arena.char.rank : acc.lastCharClimb) : player.arena.char.rank;
                    acc.lastCharRank = player.arena.char.rank;
                }
                if (player.arena.ship && player.arena.ship.rank) {
                    if (["both", "fleet"].includes(user.arenaAlert.arena)) {
                        let then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").subtract(5, "h");
                        if (then.unix() < now.unix()) {
                            then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").add(19, "h");
                        }

                        const minTil =  parseInt((then-now)/60/1000, 10);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";
                        const pUser = await client.users.fetch(patron.discordID);
                        if (pUser) {
                            try {
                                if (user.arenaAlert.payoutWarning > 0) {
                                    if (user.arenaAlert.payoutWarning  === minTil) {
                                        pUser.send({embed: {
                                            author: {name: "Arena Payout Alert"},
                                            description: `${player.name}'s ship arena payout is in **${minTil}** minutes!`,
                                            color: "#00FF00"
                                        }});
                                    }
                                }

                                if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                    pUser.send({embed: {
                                        author: {name: "Fleet arena"},
                                        description: `${player.name}'s payout ended at **${player.arena.ship.rank}**!`,
                                        color: "#00FF00"
                                    }});
                                }

                                if (player.arena.ship.rank > acc.lastShipRank) {
                                    pUser.send({embed: {
                                        author: {name: "Fleet Arena"},
                                        description: `**${player.name}'s** rank just dropped from ${acc.lastShipRank} to **${player.arena.ship.rank}**\nDown by **${player.arena.ship.rank - acc.lastShipClimb}** since last climb`,
                                        color: "#ff0000",
                                        footer: {
                                            text: payoutTime
                                        }
                                    }});
                                }
                            } catch (e) {
                                Bot.logger.error("Broke getting ranks: " + e);
                            }
                        }
                    }
                    acc.lastShipClimb = acc.lastShipClimb ? (player.arena.ship.rank < acc.lastShipRank ? player.arena.ship.rank : acc.lastShipClimb) : player.arena.ship.rank;
                    acc.lastShipRank = player.arena.ship.rank;
                }
                if (patron.amount_cents < 500) {
                    user.accounts[user.accounts.findIndex(a => a.primary)] = acc;
                } else {
                    user.accounts[ix] = acc;
                }
                // Wait here in case of extra accounts
                await Bot.wait(750);
            }
            await Bot.userReg.updateUser(patron.discordID, user);
        }
    };

    // Send/ update a shard payout times message (Automated shardtimes)
    Bot.shardTimes = async () => {
        const patrons = await getActivePatrons();
        for (const patron of patrons) {
            if (patron.amount_cents < 100) continue;
            const user = await Bot.userReg.getUser(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.arenaWatch || !user.arenaWatch.payout) continue;
            const aw = user.arenaWatch;

            // Make sure at least one of the alerts is enabled, no point otherwise
            if ((!aw.payout.char.enabled || !aw.payout.char.channel) && (!aw.payout.fleet.enabled || !aw.payout.fleet.channel)) continue;

            // Make a copy just in case, so nothing goes wonky
            let acctCount = 0;
            if      (patron.amount_cents < 500)  acctCount = Bot.config.arenaWatchConfig.tier1;
            else if (patron.amount_cents < 1000) acctCount = Bot.config.arenaWatchConfig.tier2;
            else                                 acctCount = Bot.config.arenaWatchConfig.tier3;

            const players = JSON.parse(JSON.stringify(aw.allycodes.slice(0, acctCount)));
            if (!players || !players.length) continue;

            // If char is enabled, send it there
            if (aw.payout.char.enabled && aw.payout.char.channel) {
                const playerTimes    = getPayoutTimes(players, "char");
                const formattedEmbed = formatPayouts(playerTimes, "char");
                const sentMessage    = await sendPayoutUpdates(aw.payout, formattedEmbed, "char");
                if (sentMessage) {
                    user.arenaWatch.payout["char"].msgID = sentMessage.id;
                }
            }
            // Then if fleet is enabled, send it there as well/ instead
            if (aw.payout.fleet.enabled && aw.payout.fleet.channel) {
                const playerTimes    = getPayoutTimes(players, "fleet");
                const formattedEmbed = formatPayouts(playerTimes, "fleet");
                const sentMessage    = await sendPayoutUpdates(aw.payout, formattedEmbed, "fleet");
                if (sentMessage) {
                    user.arenaWatch.payout["fleet"].msgID = sentMessage.id;
                }
            }
            // Update the user in case something changed (Likely message ID)
            await Bot.userReg.updateUser(patron.discordID, user);
        }
    };

    // Format the output for the payouts embed
    function formatPayouts(players, arena) {
        const times = {};
        arena = (arena === "fleet") ? "ship" : arena;
        const arenaString = "last" + arena.toProperCase();

        for (const player of players) {
            const rankString = player[arenaString].toString().padStart(3);
            player.outString = Bot.expandSpaces(`**\`${Bot.zws} ${rankString} ${Bot.zws}\`** - ${player.mark ? player.mark + " " : ""}${player.name}`);
            if (times[player.timeTil]) {
                times[player.timeTil].players.push(player);
            } else {
                times[player.timeTil] = {
                    players: [player]
                };
            }
        }
        const fieldOut = [];
        for (const key of Object.keys(times)) {
            const time = times[key];
            fieldOut.push({
                name: "PO in " + key,
                value: time.players.sort((a, b) => a[arenaString] - b[arenaString]).map(p => p.outString).join("\n")
            });
        }
        return {
            title: "Payout Schedule",
            description: "=".repeat(25),
            fields: fieldOut,
            footer: {
                text: `Last Updated: ${moment().utc().format("H:mm")} UTC`
            }
        };
    }

    // Send updated payout times to the given channel
    async function sendPayoutUpdates(payout, outEmbed, arena) {
        // Use broadcastEval to check all shards for the channel, and if there's a valid message
        // there, edit it. If not, send a fresh copy of it.
        const messages = await client.shard.broadcastEval(`
            (async () => {
                let channel = this.channels.cache.get('${payout[arena].channel}');
                let msg, targetMsg;
                if (channel) {
                    if (!${payout[arena].msgID}) {
                        targetMsg = await channel.send({embed: ${JSON.stringify(outEmbed)}});
                    } else {
                        try {
                            msg = await channel.messages.fetch('${payout[arena].msgID}');
                        } catch (e) {
                            msg = null;
                        }
                        if (msg) {
                            targetMsg = await msg.edit({embed: ${JSON.stringify(outEmbed)}});
                        } else {
                            targetMsg = await channel.send({embed: ${JSON.stringify(outEmbed)}});
                        }
                    }
                }
                return targetMsg;
            })();
        `);
        const msg = messages.filter(a => !!a);
        return msg.length ? msg[0] : null;
    }

    // Go through the given list and return how long til payouts
    function getPayoutTimes(players, arena) {
        const offsets = {
            char: {
                start: 18,
                end: 6
            },
            fleet: {
                start: 19,
                end: 5
            }
        };
        const now = moment().utc();
        for (const player of players) {
            if (!player.poOffset && player.poOffset !== 0) continue;
            let then = moment(now).utcOffset(player.poOffset).endOf("day").subtract(offsets[arena].end, "h");
            if (then.unix() < now.unix()) {
                then = moment(now).utcOffset(player.poOffset).endOf("day").add(offsets[arena].start, "h");
            }
            player.duration = then-now;
            player.timeTil = moment.duration(player.duration).format("h[h] m[m]");
        }
        return players.sort((a, b) => a.duration > b.duration ? 1 : -1);
    }

    // Go through a given list and get the payout times for both arenas
    function getAllPayoutTimes(player) {
        const offsets = {
            char: {
                start: 18,
                end: 6
            },
            fleet: {
                start: 19,
                end: 5
            }
        };
        const payout = {
            poOffset: player.poOffset
        };
        const now = moment().utc();
        for (const arena of ["fleet", "char"]) {
            if (!payout.poOffset && payout.poOffset !== 0) continue;
            let then = moment(now).utcOffset(payout.poOffset).endOf("day").subtract(offsets[arena].end, "h");
            if (then.unix() < now.unix()) {
                then = moment(now).utcOffset(payout.poOffset).endOf("day").add(offsets[arena].start, "h");
            }
            payout[arena + "Duration"] = then-now;
            payout[arena + "TimeTil"] = moment.duration(payout[arena + "Duration"]).format("h[h] m[m]");
        }
        return payout;
    }

    // Check for updated ranks across up to 50 players
    Bot.shardRanks = async () => {
        const patrons = await getActivePatrons();
        for (const patron of patrons) {
            const compChar = [];  // Array to keep track of allycode, toRank, and fromRank
            const compShip = [];  // Array to keep track of allycode, toRank, and fromRank
            // For each person that qualifies, go through their list
            //   - Check their patreon level and go through their top x ally codes based on the lvl
            //   - check the arena rank
            //   - save that change somewhere
            //   - for each next one, see if someone else had the opposite move

            // user = {
            //     ...
            //     arenaWatch: {
            //         enabled: true/ false,
            //         arena: {
            //             fleet: {
            //                 channel: chID,
            //                 enabled: true/ false
            //             },
            //             char: {
            //                 channel: chID,
            //                 enabled: true/ false
            //             }
            //         }
            //         allycodes: [
            //             {
            //                 "allyCode": 123123123                // The player's ally code
            //                 "name" :    "NameHere"               // The player's name (From the game)
            //                 "mention":  "discordUserID"          // If they want to be mentioned when they drop, their ID goes here
            //                 "lastChar": 53                       // Their last char arena rank
            //                 "lastShip": 35                       // Their last ship arena rank
            //                 "poOffset": -480                     // The utc offset for their payout
            //                 "mark" :    "Emote/Mark"             // An emote or other mark to tag a player in the monitor
            //                 "warn":     {min: 30, arena: ""}     // # of min before a payout to mention someone
            //                 "result":   "none|char|fleet|both"   // This will send a message with their payout result, and mention em if available
            //              }
            //         ]
            //     }
            // };
            // payout = {
            //     // Temp ones that don't get saved
            //     "charDuration"
            //     "charTimeTil"
            //     "fleetDuration"
            //     "fleetTimeTil"
            // }

            if (patron.amount_cents < 100) continue;
            const user = await Bot.userReg.getUser(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.accounts || !user.accounts.length || !user.arenaWatch) continue;
            const aw = user.arenaWatch;

            // If they don't want any alerts
            if (!aw.enabled
                || (!aw.arena?.fleet?.channel && !aw.arena?.char?.channel)
                || (!aw.arena?.fleet?.enabled && !aw.arena?.char?.enabled)) {
                continue;
            }

            let acctCount = 0;
            if      (patron.amount_cents < 500)  acctCount = Bot.config.arenaWatchConfig.tier1;
            else if (patron.amount_cents < 1000) acctCount = Bot.config.arenaWatchConfig.tier2;
            else                                 acctCount = Bot.config.arenaWatchConfig.tier3;

            const accountsToCheck = JSON.parse(JSON.stringify(aw.allycodes.slice(0, acctCount)));
            const allyCodes = accountsToCheck.map(a => a.allyCode ?  a.allyCode : a);
            if (!allyCodes || !allyCodes.length) continue;

            const newPlayers = await Bot.swgohAPI.getPlayersArena(allyCodes);
            if (allyCodes.length !== newPlayers.length) Bot.logger.error(`Did not get all players! ${newPlayers.length}/${allyCodes.length}`);

            // Go through all the listed players, and see if any of them have shifted arena rank or payouts incoming
            let charOut = [];
            let shipOut = [];
            // console.log(accountsToCheck);
            accountsToCheck.forEach((player, ix) => {
                let newPlayer = newPlayers.find(p => p.allyCode === parseInt(player.allyCode, 10));
                if (!newPlayer) {
                    newPlayer = newPlayers.find(p => p.allyCode === parseInt(player, 10));
                }
                if (!newPlayer) {
                    return;
                }
                if (!player.name) {
                    player.name = newPlayer.name;
                }
                if (!player.poOffset || player.poOffset !== newPlayer.poUTCOffsetMinutes) {
                    player.poOffset = newPlayer.poUTCOffsetMinutes;
                }
                if (!player.lastChar || newPlayer.arena.char.rank !== player.lastChar) {
                    compChar.push({
                        name: player.mention ? `<@${player.mention}>` : newPlayer.name,
                        allyCode: player.allyCode,
                        oldRank: player.lastChar || 0,
                        newRank: newPlayer.arena.char.rank
                    });
                    player.lastChar = newPlayer.arena.char.rank;
                }
                if (!player.lastShip || newPlayer.arena.ship.rank !== player.lastShip) {
                    compShip.push({
                        name: player.mention ? `<@${player.mention}>`: newPlayer.name,
                        allyCode: player.allyCode,
                        oldRank: player.lastShip || 0,
                        newRank: newPlayer.arena.ship.rank
                    });
                    player.lastShip = newPlayer.arena.ship.rank;
                }

                if (player.result || (player.warn && player.warn.min > 0 && player.warn.arena)) {
                    const payouts = getAllPayoutTimes(player);
                    const pName = player.mention ? `<@${player.mention}>` : player.name;
                    const charMinLeft  = Math.floor(payouts.charDuration  / 60000);
                    const fleetMinLeft = Math.floor(payouts.fleetDuration / 60000);
                    if (charMinLeft === 0 && ["char", "both"].includes(player.result)) {
                        // If they have char payouts turned on, do that here
                        charOut.push(`${pName} finished at ${player.lastChar} in character arena`);
                    }
                    if (player.warn && player.warn.min
                        && ["char", "both"].includes(player.warn.arena)
                        && charMinLeft === player.warn.min) {
                        // Warn them of their upcoming payout if this is enabled
                        charOut.push(`${pName}'s **character** arena payout is in ${player.warn.min + " minutes"}`);
                    }
                    if (fleetMinLeft === 0 && ["fleet", "both"].includes(player.result)) {
                        // If they have fleet payouts turned on, do that here
                        shipOut.push(`${pName} finished at ${player.lastShip} in fleet arena`);
                    }
                    if (player.warn && player.warn.min
                        && ["fleet", "both"].includes(player.warn.arena)
                        && fleetMinLeft === player.warn.min) {
                        // Warn them of their upcoming payout if this is enabled
                        shipOut.push(`${pName}'s **fleet** arena payout is in ${player.warn.min + " minutes"}`);
                    }
                }
                accountsToCheck[ix] = player;
            });

            if (compChar.length && aw.arena.char.enabled) {
                charOut = charOut.concat(checkRanks(compChar));
            }
            if (compShip.length && aw.arena.fleet.enabled) {
                shipOut = shipOut.concat(checkRanks(compShip));
            }

            const charFields = [];
            const shipFields = [];
            if (charOut.length) {
                charFields.push("**Character Arena:**");
                charFields.push(charOut.map(c => "- " + c).join("\n"));
            }
            if (shipOut.length) {
                shipFields.push("**Fleet Arena:**");
                shipFields.push(shipOut.map(c => "- " + c).join("\n"));
            }
            if (charFields.length || shipFields.length) {
                // If something has changed, update the user & let them know
                user.arenaWatch.allycodes = accountsToCheck;
                await Bot.userReg.updateUser(patron.discordID, user);

                if (aw.arena.char.channel === aw.arena.fleet.channel) {
                    // If they're both set to the same channel, send it all
                    const fields = charFields.concat(shipFields);
                    client.shard.broadcastEval(`
                        const chan = this.channels.cache.get("${aw.arena.char.channel}");
                        if (chan && chan.permissionsFor(this.user.id).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) {
                            chan.send(\`>>> ${fields.join("\n")}\`);
                        }
                    `);
                } else {
                    // Else they each have their own channels, so send em there
                    if (aw.arena.char.channel && aw.arena.char.enabled && charFields.length) {
                        client.shard.broadcastEval(`
                            const chan = this.channels.cache.get("${aw.arena.char.channel}");
                            if (chan && chan.permissionsFor(this.user.id).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) {
                                chan.send(\`>>> ${charFields.join("\n")}\`);
                            }
                        `);
                    }
                    if (aw.arena.fleet.channel && aw.arena.fleet.enabled && shipFields.length) {
                        client.shard.broadcastEval(`
                            const chan = this.channels.cache.get("${aw.arena.fleet.channel}");
                            if (chan && chan.permissionsFor(this.user.id).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) {
                                chan.send(\`>>> ${shipFields.join("\n")}\`);
                            }
                        `);
                    }
                }
            }
        }
    };

    // Compare ranks to see if we have both sides of the fight or not
    function checkRanks(inArr) {
        const checked = [];
        const outArr = [];
        for (let ix = 0; ix < inArr.length; ix++) {
            for (let jx = 0; jx < inArr.length; jx++) {
                const isChecked = checked.includes(inArr[ix].allyCode) || checked.includes(inArr[jx].allyCode);
                if (!isChecked && inArr[ix].oldRank === inArr[jx].newRank && inArr[ix].newRank === inArr[jx].oldRank) {
                    // Then they likely swapped spots
                    if (inArr[ix].oldRank > inArr[ix].newRank) {
                        outArr.push(`${inArr[ix].name} has hit ${inArr[jx].name} down from ${inArr[jx].oldRank} to ${inArr[jx].newRank}`);
                    } else {
                        outArr.push(`${inArr[jx].name} has hit ${inArr[ix].name} down from ${inArr[ix].oldRank} to ${inArr[ix].newRank}`);
                    }

                    // Put the players into the checked array so we can make sure not to log it twice
                    checked.push(inArr[ix].allyCode);
                    checked.push(inArr[jx].allyCode);
                }
            }
        }
        inArr.forEach(player => {
            if (!checked.includes(player.allyCode)) {
                outArr.push(`${player.name} has ${player.oldRank < player.newRank ? "dropped" : "climbed"} from ${player.oldRank} to ${player.newRank}`);
            }
        });
        return outArr;
    }
};
