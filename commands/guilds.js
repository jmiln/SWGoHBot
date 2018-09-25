const Command = require("../base/Command");

class Guilds extends Command {
    constructor(client) {
        super(client, {
            name: "guilds",
            category: "SWGoH",
            aliases: ["guild", "g"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "min": {
                    aliases: ["minimal", "minimize", "m"]
                },
                "roster": {
                    aliases: ["r"]
                },
                "a": {
                    aliases: ["allycodes", "allycode"]
                },
                "registered": {
                    aliases: ["reg"]
                }
            }
        });
    }

    async run(client, message, [userID, ...args], options) { // eslint-disable-line no-unused-vars
        // Basic, with no args, shows the top ## guilds (Based on how many have registered)
        // <allyCode | mention | guildName >
        
        // Shows your guild's total GP, average GP, and a list of your members
        // Not trying to get any specific guild, show em the top ones
        let acType = true;
        if (!userID) {
            userID = "me";
        } 
        
        const msg = await message.channel.send(message.language.get("COMMAND_GUILDS_PLEASE_WAIT"));

        // Get the user's ally code from the message or psql db
        if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
            userID = await client.getAllyCode(message, userID);
            if (!userID.length) {
                return msg.edit(message.language.get("COMMAND_GUILDS_REG_NEEDED"));
            }
            userID = userID[0];
        } else {
            // Or, if they don't have one of those, try getting the guild by name
            userID += args.length ? " " + args.join(" ") : "";
            acType = false;
            // return msg.edit("I currently do not support looking up guilds by name, please use an ally code, or mention someone that has registered.");
        }

        let guild = null;
        try {
            if (acType) {
                guild = await client.swgohAPI.guild(userID);
            } else {
                guild = await client.swgohAPI.guildByName(userID);
            }
        } catch (e) {
            console.log("ERROR(guilds): " + e);
            return msg.edit("Error: " + client.codeBlock(e));
        }

        if (!guild) {
            return msg.edit(message.language.get("COMMAND_GUILDS_NO_GUILD"));
        } 

        if (options.flags.roster) {
            // Display the roster with gp etc
            if (!guild.roster.length) {
                return msg.edit(message.language.get("COMMAND_GUILDS_NO_GUILD"));
            }
            const sortedGuild = options.flags.a ? guild.roster.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1) : guild.roster.sort((p, c) => c.gp - p.gp);

            const users = [];
            for (const p of sortedGuild) {
                // Check if the player is registered, then bold the name if so
                const exists = await client.database.models.allyCodes.findOne({where: {allyCode: p.allyCode}})
                    .then(token => token !== null)
                    .then(isUnique => isUnique);
                if (exists) {
                    const codes = await client.database.models.allyCodes.findAll({where: {allyCode: p.allyCode}});
                    for (const c of codes) {
                        // Make sure they're in the same server
                        if (message.guild && message.guild.members.has(c.id)) {
                            p.inGuild = true;
                            break;
                        }
                    }                    
                } 
                if (options.flags.a) {
                    if (p.inGuild) {
                        users.push(`\`[${p.allyCode}]\` - **${p.name}**`);
                    } else {
                        users.push(`\`[${p.allyCode}]\` - ${p.name}`);
                    }
                } else {
                    if (p.inGuild) {
                        users.push(`\`[${" ".repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - **${p.name}**`);
                    } else {
                        users.push(`\`[${" ".repeat(9 - p.gp.toLocaleString().length) + p.gp.toLocaleString()} GP]\` - ${p.name}`);
                    }
                }
            }
            return msg.edit({embed: {
                author: {
                    name: message.language.get("COMMAND_GUILDS_USERS_IN_GUILD", users.length, guild.name)
                },
                description: options.flags.min ? "" : users.join("\n"),
                fields: [
                    {
                        name: message.language.get("COMMAND_GUILDS_GUILD_GP_HEADER"),
                        value: client.codeBlock(message.language.get("COMMAND_GUILDS_GUILD_GP", guild.gp.toLocaleString(), Math.floor(guild.gp/users.length).toLocaleString()))
                    }
                ]
            }});
        } else {
            // Show basic stats. info about the guild
            const fields = [];
            let desc = guild.desc ? `**${message.language.get("COMMAND_GUILDS_DESC")}:**\n\`${guild.desc}\`\n` : "";
            desc += (guild.message && guild.message.length) ? `**${message.language.get("COMMAND_GUILDS_MSG")}:**\n\`${guild.message}\`` : "";

            const raidStr = message.language.get("COMMAND_GUILDS_RAID_STRINGS");
            let raids = "";

            if (guild.raid && Object.keys(guild.raid).length) {
                Object.keys(guild.raid).forEach(r => {
                    raids += `${raidStr[r]}${guild.raid[r].includes("HEROIC") ? raidStr.heroic : guild.raid[r].replace("DIFF0", "T")}\n`;
                });
            } else {
                raids = "No raids available";
            }

            fields.push({
                name: raidStr.header,
                value: client.codeBlock(raids),
                inline: true
            });
    
            const stats = message.language.get("COMMAND_GUILDS_STAT_STRINGS", guild.members, guild.required, guild.gp.toLocaleString());
            fields.push({
                name: message.language.get("COMMAND_GUILDS_STAT_HEADER"),
                value: client.codeBlock(stats),
                inline: true
            });

            fields.push({
                name: "-",
                value: message.language.get("COMMAND_GUILDS_FOOTER", message.guildSettings.prefix)
            });
            return msg.edit({embed: {
                author: {
                    name: guild.name
                },
                description: desc.length ? desc : "",
                fields: fields.length ? fields : [],
                footer: {
                    text: message.language.get("BASE_SWGOH_LAST_UPDATED", client.duration(guild.updated, message))
                }
            }});
        }
    }
}

module.exports = Guilds;

