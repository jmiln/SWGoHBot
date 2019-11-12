const moment = require("moment");
const request = require("request-promise-native");

module.exports = (Bot, client) => {
    // Get all patrons and their info
    Bot.updatePatrons = async () => {
        const patreon = Bot.config.patreon;
        if (!patreon) {
            return;
        }
        try {
            let response = await request({
                headers: {
                    Authorization: "Bearer " + patreon.creatorAccessToken
                },
                uri: "https://www.patreon.com/api/oauth2/api/current_user/campaigns",
                json: true
            });

            if (response && response.data && response.data.length) {
                response = await request({
                    headers: {
                        Authorization: "Bearer " + patreon.creatorAccessToken
                    },
                    uri: "https://www.patreon.com/api/oauth2/api/campaigns/1328738/pledges?page%5Bcount%5D=100",
                    json: true
                });

                const data = response.data;
                const included = response.included;

                const pledges = data.filter(data => data.type === "pledge");
                const users = included.filter(inc => inc.type === "user");

                pledges.forEach(pledge => {
                    const user = users.find(user => user.id === pledge.relationships.patron.data.id);
                    if (user) {
                        Bot.cache.put("swgohbot", "patrons", {id: pledge.relationships.patron.data.id}, {
                            id:                 pledge.relationships.patron.data.id,
                            full_name:          user.attributes.full_name,
                            vanity:             user.attributes.vanity,
                            email:              user.attributes.email,
                            discordID:          user.attributes.social_connections.discord ? user.attributes.social_connections.discord.user_id : null,
                            amount_cents:       pledge.attributes.amount_cents,
                            declined_since:     pledge.attributes.declined_since,
                            pledge_cap_cents:   pledge.attributes.pledge_cap_cents,
                        });
                    }
                });
            }
        } catch (e) {
            console.log("Error getting patrons");
        }
    };

    // Check if a given user is a patron, and if so, return their info
    Bot.getPatronUser = async (userId) => {
        if (!userId) return new Error("Missing user ID");
        if (userId === Bot.config.ownerid || Bot.config.patrons.indexOf(userId) > -1) return {discordID: userId, amount_cents: 100};
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
                patrons.push({discordID: u, amount_cents: 100});
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
                    player = await Bot.swgohAPI.fastPlayer(acc.allyCode);
                } catch (e) {
                    // Wait since it won't happen later when something breaks
                    await Bot.wait(500);
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
                if (player.arena.char && player.arena.char.rank) {
                    if (["both", "char"].includes(user.arenaAlert.arena)) {
                        let then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").subtract(6, "h");
                        if (then.unix() < now.unix()) {
                            then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").add(18, "h");
                        }
                        const minTil =  parseInt((then-now)/60/1000);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";

                        const pUser = await client.fetchUser(patron.discordID);
                        if (pUser) {
                            if (user.arenaAlert.payoutWarning > 0) {
                                if (user.arenaAlert.payoutWarning  === minTil) {
                                    pUser.send({embed: {
                                        author: {name: "Arena Payout Alert"},
                                        description: `${player.name}'s character arena payout is in **${minTil}** minutes!\nYour current rank is ${player.arena.char.rank}`,
                                        color: 0x00FF00
                                    }});
                                }
                            }
                            if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                pUser.send({embed: {
                                    author: {name: "Character arena"},
                                    description: `${player.name}'s payout ended at **${player.arena.char.rank}**!`,
                                    color: 0x00FF00
                                }});
                            }

                            if (player.arena.char.rank > acc.lastCharRank) {
                                // DM user that they dropped
                                pUser.send({embed: {
                                    author: {name: "Character Arena"},
                                    description: `**${player.name}'s** rank just dropped from ${acc.lastCharRank} to **${player.arena.char.rank}**\nDown by **${player.arena.char.rank - acc.lastCharClimb}** since last climb`,
                                    color: 0xff0000,
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
                        const pUser = await client.fetchUser(patron.discordID);
                        if (pUser) {
                            if (user.arenaAlert.payoutWarning > 0) {
                                if (user.arenaAlert.payoutWarning  === minTil) {
                                    pUser.send({embed: {
                                        author: {name: "Arena Payout Alert"},
                                        description: `${player.name}'s ship arena payout is in **${minTil}** minutes!`,
                                        color: 0x00FF00
                                    }});
                                }
                            }

                            if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                pUser.send({embed: {
                                    author: {name: "Fleet arena"},
                                    description: `${player.name}'s payout ended at **${player.arena.ship.rank}**!`,
                                    color: 0x00FF00
                                }});
                            }

                            if (player.arena.ship.rank > acc.lastShipRank) {
                                pUser.send({embed: {
                                    author: {name: "Fleet Arena"},
                                    description: `**${player.name}'s** rank just dropped from ${acc.lastShipRank} to **${player.arena.ship.rank}**\nDown by **${player.arena.ship.rank - acc.lastShipClimb}** since last climb`,
                                    color: 0xff0000,
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
                await Bot.wait(500);
            }
            await Bot.userReg.updateUser(patron.discordID, user);
        }
    };
};
