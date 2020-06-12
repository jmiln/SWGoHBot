const moment = require("moment");

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
                    player = await Bot.swgohAPI.unitStats(acc.allyCode, null, {force: true});
                    if (Array.isArray(player)) player = player[0];
                    // player = await Bot.swgohAPI.fastPlayer(acc.allyCode);
                } catch (e) {
                    // Wait since it won't happen later when something breaks
                    await Bot.wait(750);
                    return console.log("Broke in getRanks: " + e.message);
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
                        const minTil =  parseInt((then-now)/60/1000);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";

                        const pUser = await client.users.fetch(patron.discordID);
                        if (pUser) {
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

                        const minTil =  parseInt((then-now)/60/1000);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";
                        const pUser = await client.users.fetch(patron.discordID);
                        if (pUser) {
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

            if (patron.amount_cents < 100) continue;
            const user = await Bot.userReg.getUser(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.accounts.length) continue;

            // If they don't want any alerts
            if (!user.arenaWatch || user.arenaWatch.enabled === "off" || !user.arenaWatch.channel || user.arenaWatch.arena === "none") continue;
            let acctCount = 0;
            if      (patron.amount_cents < 500)  acctCount = 1;
            else if (patron.amount_cents < 1000) acctCount = 10;
            else                                 acctCount = 30;
            const accountsToCheck = JSON.parse(JSON.stringify(user.arenaWatch.allycodes.slice(0, acctCount)));
            const oldPlayers = await Bot.swgohAPI.unitStats(accountsToCheck);
            const newPlayers = await Bot.swgohAPI.unitStats(accountsToCheck, null, {force: true});

            // Go through all the listed players, and see if any of them have shifted arena rank
            oldPlayers.forEach(player => {
                const newPlayer = newPlayers.find(p => p.allyCode === player.allyCode);

                if (newPlayer.arena.char.rank !== player.arena.char.rank) {
                    compChar.push({
                        name: player.name,
                        allycode: player.allyCode,
                        oldRank: player.arena.char.rank,
                        newRank: newPlayer.arena.char.rank
                    });
                }
                if (newPlayer.arena.ship.rank !== player.arena.ship.rank) {
                    compShip.push({
                        name: player.name,
                        allycode: player.allyCode,
                        oldRank: player.arena.ship.rank,
                        newRank: newPlayer.arena.ship.rank
                    });
                }
            });

            let charOut = [];
            if (compChar.length && ["char", "both"].includes(user.arenaWatch.arena.toLowerCase())) {
                charOut = checkRanks(compChar);
            }

            let shipOut = [];
            if (compShip.length && ["fleet", "both"].includes(user.arenaWatch.arena.toLowerCase())) {
                shipOut = checkRanks(compShip);
            }
            const fields = [];
            if (charOut.length) {
                fields.push({
                    name: "Character Arena:",
                    value: charOut.map(c => "- " + c).join("\n")
                });
            }
            if (shipOut.length) {
                fields.push({
                    name: "Ship Arena:",
                    value: shipOut.map(s => "- " + s).join("\n")
                });
            }
            if (fields.length) {
                client.shard.broadcastEval(`
                    const chan = this.channels.cache.get("${user.arenaWatch.channel}");
                    if (chan) {
                        chan.send({embed: {
                            title: "Arena Updates",
                            fields: ${JSON.stringify(fields)}
                        }});
                    }
                `);
            }
        }
    };

    function checkRanks(inArr) {
        const checked = [];
        const outArr = [];
        for (let ix = 0; ix < inArr.length; ix++) {
            for (let jx = 0; jx < inArr.length; jx++) {
                const isChecked = checked.includes(inArr[ix].allycode) || checked.includes(inArr[jx].allycode);
                if (!isChecked && inArr[ix].oldRank === inArr[jx].newRank && inArr[ix].newRank === inArr[jx].oldRank) {
                    // Then they likely swapped spots
                    if (inArr[ix].oldRank > inArr[ix].newRank) {
                        outArr.push(`${inArr[ix].name} has hit ${inArr[jx].name} down from ${inArr[jx].oldRank} to ${inArr[jx].newRank}`);
                    } else {
                        outArr.push(`${inArr[jx].name} has hit ${inArr[ix].name} down from ${inArr[ix].oldRank} to ${inArr[ix].newRank}`);
                    }

                    // Put the players into the checked array so we can make sure not to log it twice
                    checked.push(inArr[ix].allycode);
                    checked.push(inArr[jx].allycode);
                }
            }
        }
        inArr.forEach(player => {
            if (!checked.includes(player.allycode)) {
                outArr.push(`${player.name} has ${player.oldRank < player.newRank ? "dropped" : "climbed"} from ${player.oldRank} to ${player.newRank}`);
            }
        });
        return outArr;
    }

};
