## TODO list for v13 upgrades

# Update the permissions checker
- Maybe return an array of the valid perms, consisting of all levels that match for the user (Max and below)
    * This would make it so it can have differing ones like Patreon, but not give the user more admin perms, or people with admin perms having patreon abilities
    * Also, this would means checking if the permission is in the array vs checking if the perm is at or above?

# Changelog  (Still needs a slash variant)
- Possibly update this in case I ever get the site moved over
- If this is going to be updated, it needs to wait for them to add line returns to the commands, too much of a mess to do how it is currently

# GuildUpdate
- Need to change the guildlog between swapi & patreonFuncs to be indexed by ally code, rather than name since names can be dupes

# Setconf
- Make it so only differences are stored. If it's the same as the default settings, there's no reason to keep a copy
    * This would also remove the need to check every guild when loading in/ spawning each shard, so hopefully it'd speed that mess up too
- Should also transfer it over to mongo, along with everything else so it's all in one spot

# Poll
- Use buttons and/ or dropdown to vote?
- Now that the modals are supported and live, figure out how to use those

