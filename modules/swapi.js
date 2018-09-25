const {inspect} = require("util");
module.exports = (client) => {
    const swgoh = client.swgoh;
    const cache = client.cache;

    const playerCooldown = 2;
    const guildCooldown  = 6;
    const eventCooldown  = 12;
    const zetaCooldown   = 7 * 24; // 7 days

    return {
        player: player,
        playerByName: playerByName,
        unitStats: unitStats,
        guild: guild,
        guildByName: guildByName,
        guildGG: guildGG,
        zetaRec: zetaRec,
        events: events,
        register: register,
        whois: whois
    };

    async function player( allycode, lang, cooldown) {
        lang = lang ? lang : "ENG_US";
        if (cooldown) {
            if (cooldown > playerCooldown) cooldown = playerCooldown;
            if (cooldown < 1) cooldown = 1;
        } else {
            cooldown = playerCooldown;
        }
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            let player = await cache.get("swapi", "players", {allyCode:allycode});

            /** Check if existance and expiration */
            if ( !player || !player[0] || isExpired(player[0].updated, cooldown) ) {
                /** If not found or expired, fetch new from API and save to cache */
                player = await swgoh.fetchPlayer({
                    allycode: allycode,
                    language: lang,
                    enums: true
                });

                if (player[0]) {
                    player = player[0];
                }

                if (!player || !player.roster || !player.name) {
                    throw new Error("Broke getting player: " + inspect(player));
                }

                if (player._id) delete player._id;
                player = await cache.put("swapi", "players", {allyCode:allycode}, player);
            } else {
                /** If found and valid, serve from cache */
                player = player[0];
            }
            return player;
        } catch (e) {
            console.log("SWAPI Broke getting player: " + e);
            throw e;
        }
    }

    async function playerByName(name) {
        try {
            if (!name || !name.length) return null;
            if (typeof name !== "string") name = name.toString();

            /** Try to get player's ally code from cache */
            const player = await cache.get("swapi", "players", {name:name}, {allyCode: 1, _id: 0});

            return player;
        } catch (e) {
            console.log("SWAPI Broke getting player: " + e);
            throw e;
        }
    }

    async function unitStats(allycode, cooldown) {
        if (cooldown) {
            if (cooldown > playerCooldown) cooldown = playerCooldown;
            if (cooldown < 1) cooldown = 1;
        } else {
            cooldown = playerCooldown;
        }
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            let expiredDate = new Date();
            expiredDate = expiredDate.setHours(expiredDate.getHours() - cooldown);

            let playerStats = null;

            playerStats = await cache.get("swapi", "playerStats", {allyCode:allycode, updated:{ $gte:expiredDate }});

            if (!playerStats || !playerStats[0]) {
                let player, barePlayer;
                try {
                    player = await this.player(allycode);
                    barePlayer = await swgoh.fetchPlayer({allycode: allycode});
                } catch (error) {
                    throw new Error("Error getting player in unitStats: " + error);
                }
                if (Array.isArray(player)) { player = player[0]; }
                if (Array.isArray(barePlayer)) { barePlayer = barePlayer[0]; }
                // Strip out the ships since you can't get the stats for em yet
                barePlayer.roster = barePlayer.roster.filter(c => c.crew.length === 0);

                try {
                    playerStats = await swgoh.rosterStats(barePlayer.roster, ["withModCalc","gameStyle"]);
                } catch (error) {
                    throw new Error("Error getting player stats: " + error);
                }

                playerStats.forEach(c => {
                    const char = player.roster.find(u => u.defId === c.unit.defId);
                    c.unit.gp   = char.gp;
                    c.unit.skills = char.skills;
                    c.unit.name = char.name;
                    c.unit.player = player.name;
                    delete c.unit.mods;
                });

                const stats = {
                    allyCode: player.allyCode,
                    updated: player.updated,
                    stats: playerStats
                };

                playerStats = await cache.put("swapi", "playerStats", {allyCode: allycode, updated: player.updated}, stats);
                playerStats = playerStats.stats;
            } else {
                playerStats = playerStats[0].stats;
            }
            return playerStats;
        } catch (error) {
            console.log("SWAPI Broke getting playerStats: " + error);
            throw error;
        }
    }

    async function guild( allycode, lang="ENG_US", update=false ) {
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await this.player(allycode);
            if (!player) { throw new Error("I don't know this player, make sure they're registered first"); }
            if (!player.guildName) throw new Error("Sorry, that player is not in a guild");

            let guild  = await cache.get("swapi", "guilds", {name:player.guildName});

            /** Check if existance and expiration */
            if ( !guild || !guild[0] || isExpired(guild[0].updated, guildCooldown) ) {
                /** If not found or expired, fetch new from API and save to cache */
                guild = await swgoh.fetchGuild({
                    allycode: allycode,
                    language: lang,
                    enums: true
                });

                if (!guild || !guild.roster || !guild.name) {
                    throw new Error("Broke getting guild: " + inspect(guild));
                }

                if (guild._id) delete guild._id;  // Delete this since it's always whining about it being different
                guild = await cache.put("swapi", "guilds", {name:guild.name}, guild);

                if (update) {
                    for ( const p of guild.roster ) {
                        await this.player(p.allyCode.toString());
                    }
                }
            } else {
                /** If found and valid, serve from cache */
                guild = guild[0];
            }
            return guild;
        } catch (e) {
            console.log("SWAPI(guild) Broke getting guild: " + e);
            throw e;
        }
    }

    async function guildByName( gName ) {
        try {
            const guild  = await cache.get("swapi", "guilds", {name:gName});

            if ( !guild || !guild[0] ) {
                return null;
            }
            return guild[0];
        } catch (e) {
            console.log("SWAPI(guild) Broke getting guild: " + e);
            throw e;
        }
    }

    async function guildGG( allycode, lang="ENG_US" ) {
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error("Please provide a valid allycode"); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await this.player(allycode);
            if (!player) { throw new Error("I don't know this player, make sure they're registered first"); }
            if (!player.guildName) throw new Error("Sorry, that player is not in a guild");

            let guildGG  = await cache.get("swapi", "guildGG", {name:player.guildName});

            /** Check if existance and expiration */
            if ( !guildGG || !guildGG[0] || isExpired(guildGG[0].updated, guildCooldown) ) {
                /** If not found or expired, fetch new from API and save to cache */
                guildGG = await swgoh.fetchGuild({
                    allycode: allycode,
                    language: lang,
                    enums: true,
                    units: true
                });

                if (!guildGG || !guildGG.roster || !guildGG.name) {
                    throw new Error("Broke getting guildGG: " + inspect(guildGG));
                }

                if (guildGG._id) delete guildGG._id;  // Delete this since it's always whining about it being different
                guildGG = await cache.put("swapi", "guildGG", {name:guildGG.name}, guildGG);
            } else {
                /** If found and valid, serve from cache */
                guildGG = guildGG[0];
            }
            return guildGG;
        } catch (e) {
            throw e;
        }
    }

    async function zetaRec( lang="ENG_US" ) {
        try {
            let zetas = await cache.get("swapi", "zetaRec", {lang:lang});

            /** Check if existance and expiration */
            if ( !zetas || !zetas[0] || !zetas[0].zetas || isExpired(zetas[0].zetas.updated, zetaCooldown) ) {
                /** If not found or expired, fetch new from API and save to cache */
                try {
                    zetas =  await swgoh.fetchAPI("/swgoh/zetas", {
                        language: lang,
                        enums: true,
                        "project": {
                            zetas: 1,
                            credits: 1,
                            updated: 1
                        }
                    });
                } catch (e) {
                    console.log("[SWGoHAPI] Could not get zetas");
                }
                zetas = {
                    lang: lang,
                    zetas: zetas
                };
                zetas = await cache.put("swapi", "zetaRec", {lang:lang}, zetas);
                zetas = zetas.zetas;
            } else {
                /** If found and valid, serve from cache */
                zetas = zetas[0].zetas;
            }
            return zetas;
        } catch (e) {
            throw e;
        }
    }

    async function events( lang="ENG_US" ) {
        try {
            /** Get events from cache */
            let events = await cache.get("swapi", "events", {lang:lang});

            /** Check if existance and expiration */
            if ( !events || !events[0] || isExpired(events[0].updated, eventCooldown) ) {
                /** If not found or expired, fetch new from API and save to cache */
                try {
                    events =  await swgoh.fetchAPI("/swgoh/events", {
                        language: lang,
                        enums: true
                    });
                } catch (e) {
                    console.log("[SWGoHAPI] Could not get events");
                }
                events = {
                    lang: lang,
                    events: events
                };
                events = await cache.put("swapi", "events", {lang:lang}, events);
            } else {
                /** If found and valid, serve from cache */
                events = events[0];
            }
            return events;
        } catch (e) {
            throw e;
        }
    }

    async function register(putArray) {
        try {
            const getArray = putArray.map(a => a[0]);

            return await swgoh.fetchAPI("/registration", {
                "put":putArray,
                "get":getArray
            });
        } catch (e) {
            throw e;
        }	
    }

    async function whois( ids ) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        if (!ids.length) return [];
        try {
            if (!ids) { 
                throw new Error("Please provide one or more allycodes or discordIds"); 
            }

            /** Get player from swapi cacher */
            return await swgoh.fetchAPI("/registration", {
                "get":ids
            });

        } catch (e) {
            throw e;
        }	
    }

    function isExpired( updated, cooldown ) {
        const diff = client.convertMS( new Date() - new Date(updated) );
        return diff.hour >= cooldown;
    }
};
