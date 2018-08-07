module.exports = (client) => {
    const swgoh = client.swgoh;
    const cache = client.cache;

    const playerCooldown = 2;
    const guildCooldown = 6;
    const eventCooldown = 12;

    return {
        player: player,
        mods: mods,
        guild: guild,
        guildGG: guildGG,
        events: events
    };

    async function mods( allycode ) {
        try {

            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            let mods = await cache.get('swapi', 'mods', {allyCode:allycode});

            /** Check if existance and expiration */
            if ( !mods || !mods[0] || isExpired(mods[0].updated, playerCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                mods = await swgoh.fetchPlayer(allycode, 'mods');
                mods = await cache.put('swapi', 'mods', {allyCode:allycode}, mods);
            } else {
                /** If found and valid, serve from cache */
                mods = mods[0];
            }
            return mods;
        } catch (e) { 
            throw e; 
        }            
    }

    async function player( allycode, lang='ENG_US' ) {
        try {

            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            let player = await cache.get('swapi', 'players', {allyCode:allycode});

            /** Check if existance and expiration */
            if ( !player || !player[0] || isExpired(player[0].updated, playerCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                player = await swgoh.fetchPlayer(allycode, null, lang);
                player = await cache.put('swapi', 'players', {allyCode:allycode}, player);
            } else {
                /** If found and valid, serve from cache */
                player = player[0];
            }
            return player;
        } catch (e) { 
            throw e; 
        }            
    }

    async function guild( allycode ) {
        try {
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await cache.get('swapi', 'players', {allyCode:allycode});
            if ( !player || !player[0] ) { throw new Error('I don\'t know this player, try syncing them first'); }

            let guild  = await cache.get('swapi', 'guilds', {name:player[0].guildName});

            /** Check if existance and expiration */
            if ( !guild || !guild[0] || isExpired(guild[0].updated, guildCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                guild = await swgoh.fetchGuild(allycode, 'details');
                guild = await cache.put('swapi', 'guilds', {name:guild.name}, guild);

                let roster = await swgoh.fetchGuild(allycode, 'roster');
                for ( const p of roster ) {
                    cache.put('swapi', 'players', {allyCode:p.allyCode}, p);
                }
                roster = null;
            } else {
                /** If found and valid, serve from cache */
                guild = guild[0];
            }
            return guild;      
        } catch (e) { 
            throw e; 
        }            
    }

    async function guildGG( allycode ) {
        try {
            if ( !allycode || isNaN(allycode) || allycode.length !== 9 ) { throw new Error('Please provide a valid allycode'); }
            allycode = parseInt(allycode);

            /** Get player from cache */
            const player = await cache.get('swapi', 'players', {allyCode:allycode});
            if ( !player || !player[0] ) { throw new Error('I don\'t know this player, try syncing them first'); }

            let guildGG  = await cache.get('swapi', 'guildGG', {name:player[0].guildName});

            /** Check if existance and expiration */
            if ( !guildGG || !guildGG[0] || isExpired(guildGG[0].updated, guildCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                guildGG = await swgoh.fetchGuild(allycode, 'gg');
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
            let events = await cache.get('swapi', 'events', {lang:lang});

            /** Check if existance and expiration */
            if ( !events || !events[0] || isExpired(events[0].updated, eventCooldown) ) { 
                /** If not found or expired, fetch new from API and save to cache */
                events = await swgoh.fetchData('events', null, lang);
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
