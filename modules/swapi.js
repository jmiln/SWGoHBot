module.exports = (client) => {
    const swgoh = client.swgoh;
    const cache = client.cache;

    const playerCooldown = 2;
    const guildCooldown = 6;
    const eventCooldown = 12;

    return {
        player: player,
        guild: guild,
        guildByName: guildByName,
        guildGG: guildGG,
        events: events
    };

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
                    language: lang,
                    enums: true
                });

                if (player[0]) {
                    player = player[0];
                }

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
                    language: lang,
                    enums: true
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

    async function guildByName( gName ) {
        try {
            const guild  = await cache.get('swapi', 'guilds', {name:gName});

            if ( !guild || !guild[0] ) { 
                return null;
            } 
            return guild[0];      
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
                guildGG = await swgoh.fetchGuild({
                    allycode: allycode, 
                    language: lang,
                    enums: true,
                    units: true
                });
                if (guildGG._id) delete guildGG._id;  // Delete this since it's always whining about it being different
                guildGG = await cache.put('swapi', 'guildGG', {name:guildGG.name}, guildGG);
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
            let events = await cache.get('swapi', 'events', {lang:lang});

            /** Check if existance and expiration */
            if ( !events || !events[0] || isExpired(events[0].updated, eventCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                try {
                    events =  await swgoh.fetchAPI('/swgoh/events', {
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
                events = await cache.put('swapi', 'events', {lang:lang}, events);
            } else {
                /** If found and valid, serve from cache */
                events = events[0];
            }
            return events;
        } catch (e) { 
            throw e; 
        }            
    }

    function isExpired( updated, cooldown ) {
        const diff = client.convertMS( new Date() - new Date(updated) );
        return diff.hour >= cooldown;    
    }
};
