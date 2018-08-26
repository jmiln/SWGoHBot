module.exports = (client) => {
    const swgoh = client.swgoh;
    const cache = client.cache;

    const playerCooldown = 2;
    const guildCooldown = 6;
    const eventCooldown = 12;

    return {
        player: player,
        // mods: mods,
        guild: guild,
        guildGG: guildGG,
        events: events
    };

    // Decommissioned for now
    // async function mods( allycode ) {
    //     try {
    //
    //         if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
    //         allycode = parseInt(allycode);
    //
    //         #<{(|* Get player from cache |)}>#
    //         let mods = await cache.get('swapi', 'mods', {allyCode:allycode});
    //
    //         #<{(|* Check if existance and expiration |)}>#
    //         if ( !mods || !mods[0] || isExpired(mods[0].updated, playerCooldown) ) { 
    //             #<{(|* If not found or expired, fetch new from API and save to cache |)}>#
    //             // mods = await swgoh.fetchPlayer(allycode, 'mods', 'ENG_US');
    //             mods = await swgoh.fetchPlayer({
    //                 allycodes: [allycode], 
    //                 language: 'ENG_US',
    //                 project:{
    //                     mods:1,
    //                 }
    //             });
    //             const {inspect} = require('util');
    //             console.log(inspect(mods, {depth: 5}));
    //             // mods = await cache.put('swapi', 'mods', {allyCode:allycode}, mods);
    //         } else {
    //             #<{(|* If found and valid, serve from cache |)}>#
    //             mods = mods[0];
    //         }
    //         return mods;
    //     } catch (e) { 
    //         throw e; 
    //     }            
    // }

    async function player( allycode, lang, cooldown) {
        lang = lang ? lang : 'ENG_US';
        if (cooldown) {
            if (cooldown > playerCooldown) cooldown = playerCooldown;
            if (cooldown < 1) cooldown = 1;
        } else {
            cooldown = playerCooldown;
        }
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            let player = await cache.get('swapi', 'players', {allyCode:allycode});

            /** Check if existance and expiration */
            if ( !player || !player[0] || isExpired(player[0].updated, cooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                player = await swgoh.fetchPlayer({
                    allycode: allycode, 
                    language: lang
                });
                if (player._id) delete player._id;
                player = await cache.put('swapi', 'players', {allyCode:allycode}, player);
            } else {
                /** If found and valid, serve from cache */
                player = player[0];
            }
            return player;
        } catch (e) { 
            console.log('SWAPI Broke getting player: ' + e);
            throw e; 
        }            
    }

    async function guild( allycode, lang='ENG_US', update=false ) {
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await cache.get('swapi', 'players', {allyCode:allycode});
            if ( !player || !player[0] ) { throw new Error('I don\'t know this player, try syncing them first'); }

            let guild  = await cache.get('swapi', 'guilds', {name:player[0].guildName});

            /** Check if existance and expiration */
            if ( !guild || !guild[0] || isExpired(guild[0].updated, guildCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                guild = await swgoh.fetchGuild({
                    allycode: allycode, 
                    language: lang
                });

                if (guild._id) delete guild._id;  // Delete this since it's always whining about it being different
                guild = await cache.put('swapi', 'guilds', {name:guild.name}, guild);

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
            console.log('SWAPI(guild) Broke getting guild: ' + e);
            throw e; 
        }            
    }

    async function guildGG( allycode, lang='ENG_US' ) {
        try {
            if (allycode) allycode = allycode.toString();
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await cache.get('swapi', 'players', {allyCode:allycode});
            if ( !player || !player[0] ) { throw new Error('I don\'t know this player, try syncing them first'); }

            let guildGG  = await cache.get('swapi', 'guildGG', {name:player[0].guildName});

            /** Check if existance and expiration */
            if ( !guildGG || !guildGG[0] || isExpired(guildGG[0].updated, guildCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                let guild  = await cache.get('swapi', 'guilds', {name:player[0].guildName});
                if ( !guild || !guild[0] || isExpired(guild[0].updated, guildCooldown) ) { 
                    guild = await swgoh.fetchGuild({
                        allycode: allycode, 
                        language: lang
                    });
                    if (guild._id) delete guild._id;  // Delete this since it's always whining about it being different
                    guild = await cache.put('swapi', 'guilds', {name:guild.name}, guild);
                }
                let allies;
                if (typeof allies === Array) {
                    allies = guild[0].roster.map(p => p.allyCode);
                } else {
                    allies = guild.roster.map(p => p.allyCode);
                }
                guildGG = await swgoh.fetchUnits({
                    allycodes: allies,
                    mods: false
                });
                if (guildGG._id) delete guildGG._id;
                guildGG = await cache.put('swapi', 'guildGG', {name:player[0].guildName}, guildGG);
            } else {
                /** If found and valid, serve from cache */
                guildGG = guildGG[0];
            }
            return guildGG;      
        } catch (e) { 
            throw e; 
        }            
    }

    async function events( lang='ENG_US' ) {
        try {
            /** Get events from cache */
            // let events = await cache.get('swapi', 'events', {lang:lang});
            let events;

            /** Check if existance and expiration */
            if ( !events || !events[0] || isExpired(events[0].updated, eventCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                const {inspect} = require('util');
                try {
                    events =  await swgoh.fetchAPI('/swgoh/events', '');
                    // events = await swgoh.fetchData('events');
                    // events = await swgoh.fetchData({
                    //     collection: "events",
                    //     language: lang
                    // });
                    console.log("EventsOut: " + inspect(events));
                } catch (e) {
                    console.log("Could not get events");
                }
                events = {
                    lang: lang, 
                    events: events
                };
                events = await cache.put('swapi', 'events', {lang:lang}, events);
            } else {
                /** If found and valid, serve from cache */
                console.log(events);
                events = events[0];
            }
            return events;
        } catch (e) { 
            throw e; 
        }            
    }

    function isExpired( updated, cooldown ) {
        const diff = client.convertMS( new Date() - new Date(updated) );
        return diff.day > 0 || diff.hour >= cooldown;    
    }
};
