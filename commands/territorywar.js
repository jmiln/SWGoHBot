const Command = require("../base/Command");

class TerritoryWar extends Command {
    constructor(client) {
        super(client, {
            name: "territorywar",
            category: "SWGoH",
            aliases: ["twsummary", "tw"],
            permissions: ["EMBED_LINKS"],
            flags: { },
            subArgs: { }
        });
    }

    async run(client, message, [user1, user2, ...args], options) { // eslint-disable-line no-unused-vars
        const msg = await message.channel.send(message.language.get("COMMAND_GUILDS_PLEASE_WAIT"));
        const cooldown = client.getPlayerCooldown(message.author.id);
        const errArr = [];

        if (!user1) {
            return super.error(message, "No valid ally codes supplied");
        } else if (!user2) {
            return super.error(message, "I need 2 valid ally codes to work");
        }

        // Get/ verify the two ally codes
        const ac1 = await super.getUser(message, user1, true);
        if (!ac1) {
            errArr.push("Invalid user 1");
        }
        const ac2 = await super.getUser(message, user2, true);
        if (!ac2) {
            errArr.push("Invalid user 2");
        }
        if (errArr.length) {
            // Check and spit out an error if it cannot get ally codes for either one
            return super.error(message, errArr.join("\n"));
        }

        // Then get the character list for the two guilds
        let guild1, guild2;
        try {
            guild1 = await getGuildChars(ac1, cooldown);
        } catch (e) {
            errArr.push(e.message);
        }
        try {
            guild2 = await getGuildChars(ac2, cooldown);
        } catch (e) {
            errArr.push(e.message);
        }
        if (errArr.length) {
            // Check and spit out an error if something happens here
            return super.error(message, errArr.join("\n"));
        }

        // console.log(guild1);

        const stats = [
            {
                stat: "Members",
                g1: guild1.roster.length,
                g2: guild2.roster.length
            },
            {
                stat: "GP",
                g1: client.shortenNum(guild1.gp),
                g2: client.shortenNum(guild2.gp)
            },
            {
                stat: "G12",
                g1: guild1.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 12).length, 0),
                g2: guild2.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 12).length, 0)
            },
            {
                stat: "G11",
                g1: guild1.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 11).length, 0),
                g2: guild2.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 11).length, 0)
            },
            {
                stat: "G10",
                g1: guild1.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 10).length, 0),
                g2: guild2.roster.reduce((a, b) => a + b.roster.filter(c => c.gear === 10).length, 0)
            },
            {
                stat: "Zetas",
                g1: guild1.roster.reduce((a, b) => a + b.roster.reduce((c, d) => c + d.skills.filter(s => s.tier === 8 && s.isZeta).length, 0), 0),
                g2: guild2.roster.reduce((a, b) => a + b.roster.reduce((c, d) => c + d.skills.filter(s => s.tier === 8 && s.isZeta).length, 0), 0)
            },
            {
                stat: "6* Mods",
                g1: guild1.roster.reduce((a, b) => a + b.roster.reduce((c, d) => c + d.mods.filter(m => m.pips === 6).length, 0), 0),
                g2: guild2.roster.reduce((a, b) => a + b.roster.reduce((c, d) => c + d.mods.filter(m => m.pips === 6).length, 0), 0)
            },
        ];
        const table = client.makeTable({
            stat: {value: "", align: "left", endWith: "::"},
            g1: {value: "", align: "right", endWith: "vs"},
            g2: {value: "", align: "left"}
        }, stats, {useHeader: false});
        const fields = [{
            name: "=========== General Stats ===========",
            value: client.codeBlock(table.join("\n"), "asciiDoc")
        }];
        
        // Members        :: 49
        // GP             :: 114.3M
        // Avg Arena Rank :: 399.14
        // Avg Fleet Rank :: 147.73
        // G11            :: 620
        // G12            :: 640
        // G12+1          :: 120
        // G12+2          :: 125
        // G12+3          :: 168
        // G12+4          :: 8
        // Zetas          :: 911
        // 6 dot mods     :: 501
        // 10+ speed mods :: 2209
        // 15+ speed mods :: 465
        // 20+ speed mods :: 60
        // 100+ off mods  :: 520






        // if (options.defaults) {
        //     fields.push({
        //         name: "Default flags used:",
        //         value: client.codeBlock(options.defaults)
        //     });
        // }

        // const footer = client.updatedFooter(guildGG.updated, message, "guild", cooldown);
        return msg.edit({embed: {
            author: {
                name: message.language.get("COMMAND_GUILDS_TWS_HEADER", "testName")
            },
            // description: charOut.join("\n"),
            fields: fields
            // footer: footer
        }});

        async function getGuildChars(allyCode, cooldown) {
            let guild = null;
            try {
                guild = await client.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(tw): Broke getting guild\n - " + e);
                // return super.error(msg, client.codeBlock(e), {edit: true, example: "tw me"});
            }

            // if (!guild) {
            //     return super.error(msg, message.language.get("COMMAND_GUILDS_NO_GUILD"), {edit: true, example: "tw me"});
            // } 

            // Spit out a general summary of guild characters and such related to tw
            let gRoster ;
            if (!guild || !guild.roster || !guild.roster.length) {
                throw new Error(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.map(m => m.allyCode);
            }

            let players = await client.swgohAPI.players(gRoster);
            const fresh = [];
            for (const p of players) {
                if (p && !client.swgohAPI.isExpired(p.updated, cooldown, true)) {
                    gRoster.splice(gRoster.indexOf(p.allyCode), 1);
                    fresh.push(p);
                }
            }

            if (gRoster.length) {
                let newPlayers = await client.swgoh.fetchPlayer({allycode: gRoster});
                if (newPlayers.error) throw new Error(newPlayers.error);
                newPlayers = newPlayers.result;
                players = players.concat(newPlayers);
            }

            guild.roster = players;

            // let guildGG;
            // try {
            //     guildGG = await client.swgohAPI.guildGG(gRoster, null, cooldown);
            // } catch (e) {
            //     console.log("ERROR(GS) getting guild: " + e); 
            //     // return super.error(message, client.codeBlock(e), {
            //     //     title: "Something Broke while getting your guild's characters",
            //     //     footer: "Please try again in a bit."
            //     // });
            // }
            // console.log(guild);
            // guildGG.desc = guild.desc;
            // guildGG.members = guild.roster.length;
            // guildGG.gp = guild.gp;
            // guildGG.name = guild.name;
            return guild;
        } 
    } 
}

module.exports = TerritoryWar;

