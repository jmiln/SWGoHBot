const PersistentCollection = require("djs-collection-persistent");
const util = require('util');

var fs = require("fs");
var raidList = JSON.parse(fs.readFileSync("data/teams.json"));
var settings = require("../settings.json");


exports.run = (client, message, args) => {
    const guildSettings = client.guildSettings;
    const guildConf = guildSettings.get(message.guild.id);

    let currentPhase = "Solo";

    // Remove anything that's not a letter for the raid name
    let searchName = "";
    if(args[0]) {
        searchName = String(args[0]).toLowerCase().replace(/[^\w\s]/gi, '');
    }

    // Remove anything that's not a letter for the phase
    let phaseName = "";
    if(args[1]) {
        phaseName = String(args[1]).toLowerCase().replace(/[^\w\s]/gi, '');
        if(phaseName === "Solo") {
            currentPhase = "Solo"
        } else if(phaseName === "p1") {
            currentPhase = "Phase 1"
        } else if(phaseName === "p2") {
            currentPhase = "Phase 2"
        } else if(phaseName === "p3") {
            currentPhase = "Phase 3"
        } else if(phaseName === "p4") {
            currentPhase = "Phase 4"
        }
    }

    let found = false;
    let foundPhase = false;
    let embeds = false;

    if(guildConf['useEmbeds'] === true && message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
        embeds = true;
    }

    if(searchName !== "") {
        for(ix = 0; ix < raidList.length; ix++) {
            var raid = raidList[ix];

            if(raid.aliases.includes(searchName)) { // === raid.aliases[jx].toLowerCase()) {
                // Found the raid, now just need to show it
                found = true;

                teams = raid.teams;

                if(embeds) {  // if Embeds are enabled
                    let fields = [];
                    for(raidTeam in teams) {
                        let team = raid.teams[raidTeam];

                        let phase = team.phase
                        if(phase.includes(currentPhase)) {// === phase.toLowerCase()) {
                            foundPhase = true;
                            let characters = team.characters
                            fields.push({
                                "name": raidTeam,
                                "value": `**Characters:** \`${team.characters.join(", ")}\``
                            });
                        }
                    }
                    footerText = `via Morningstar-013 & Pete Butler`
                    if(foundPhase) {
                        message.channel.send({embed:{ "author": {"name": raid.name}, "title": `Showing teams for ${currentPhase}`, "color": 2, "fields": fields, "footer": {"text": footerText}}});
                    } else {
                        message.channel.send(`Cannot find any teams under \`${currentPhase}\``);
                    }
                } else {  // Embeds are disabled
                    let outString = ` * ${raid.name} * \n\n* Showing teams for ${currentPhase}\n\n`
                    for(raidTeam in teams) {
                        let team = raid.teams[raidTeam];
                        let phase = team.phase;

                        if(phase.includes(currentPhase)) {// === phase.toLowerCase()) {
                            foundPhase = true;
                            outString += `### ${raidTeam} ### \n* Characters: ${team.characters.join(", ")}\n`
                        }
                    }
                    if(foundPhase) {
                    message.channel.send(outString, {code: 'md', split: true});
                    } else {
                        message.channel.send(`Cannot find any teams under \`${currentPhase}\``);
                    }
                }
            }
        }

        if(found === false) {
            message.channel.send("Invalid raid, usage is \`" + settings.prefix + "raidteams [raidName]\`\n **Example:** " + settings.prefix + "raidteams pit");
        }
    } else {
        message.channel.send("Invalid raid, usage is \`" + settings.prefix + "raidteams [raidName]\`\n**Example:** " + settings.prefix + "raidteams pit");
    }

};

exports.conf = {
    guildOnly: false,
    enabled: true,
    aliases: ['raid'],
    permLevel: 0,
    type: 'starwars'
};

exports.help = {
    name: 'raidteams',
    description: 'Shows some teams that work well for each raid.',
    usage: 'raidteams [aat|pit] [p1|p2|p3|p4|solo]',
    example: 'raidteams aat p1'
};
