exports.run = (client, message, args) => {
    const config = client.config;
    const guildConf = message.guildSettings;
    const raidList = client.teams;

    let currentPhase = "Phase 1";

    // Make sure the args are all there
    if (typeof args[0] === 'undefined' || args[0] === null || args[0] === "") {
        return message.channel.send(`Invalid raid, usage is \`${config.prefix}${this.help.usage}\`\n**Example:** \`${config.prefix}${this.help.example}\``).then(msg => msg.delete(10000)).catch(console.error);
    }
    if (typeof args[1] === 'undefined' || args[1] === null || args[1] === "") {
        return message.channel.send(`Invalid phase, usage is \`${config.prefix}${this.help.usage}\`\n**Example:** \`${config.prefix}${this.help.example}\``).then(msg => msg.delete(10000)).catch(console.error);
    }

    // Remove anything that's not a letter for the raid name
    let searchName = "";
    if (args[0]) {
        searchName = String(args[0]).toLowerCase().replace(/[^\w\s]/gi, '');
    }

    // Remove anything that's not a letter for the phase
    if (args[1]) {
        let phaseName = "";
        phaseName = String(args[1]).toLowerCase().replace(/[^\w\s]/gi, '');
        if (phaseName === "solo") {
            currentPhase = "Solo";
        } else if (phaseName === "p1") {
            currentPhase = "Phase 1";
        } else if (phaseName === "p2") {
            currentPhase = "Phase 2";
        } else if (phaseName === "p3") {
            currentPhase = "Phase 3";
        } else if (phaseName === "p4") {
            currentPhase = "Phase 4";
        } else {
            return message.channel.send(`Invalid phase, usage is \`${config.prefix}${this.help.usage}\`\n**Example:** \`${config.prefix}${this.help.example}\``).then(msg => msg.delete(10000)).catch(console.error);
        }
    }

    let found = false;
    let foundPhase = false;

    let embeds = true;
    if (message.guild) {
        if (guildConf['useEmbeds'] !== true || !message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            embeds = false;
        }
    }

    if (searchName !== "") {
        for (var ix = 0; ix < raidList.length; ix++) {
            var raid = raidList[ix];

            if (raid.aliases.includes(searchName)) {
                // Found the raid, now just need to show it
                found = true;

                var teams = raid.teams;

                if (embeds) { // if Embeds are enabled
                    const fields = [];
                    for (raidTeam in teams) {
                        const team = raid.teams[raidTeam];

                        const phase = team.phase;
                        if (phase.includes(currentPhase)) {
                            foundPhase = true;
                            fields.push({
                                "name": raidTeam,
                                "value": `**Characters:** \`${team.characters.join(", ")}\``
                            });
                        }
                    }
                    var footerText = `via Morningstar-013 & Pete Butler`;
                    if (foundPhase) {
                        message.channel.send({
                            embed: {
                                "author": {
                                    "name": raid.name
                                },
                                "title": `Showing teams for ${currentPhase}`,
                                "color": 2,
                                "fields": fields,
                                "footer": {
                                    "text": footerText
                                }
                            }
                        });
                    } else {
                        return message.channel.send(`Cannot find any teams under \`${currentPhase}\``).then(msg => msg.delete(10000)).catch(console.error);
                    }
                } else { // Embeds are disabled
                    let outString = ` * ${raid.name} * \n\n* Showing teams for ${currentPhase}\n\n`;
                    for (var raidTeam in teams) {
                        const team = raid.teams[raidTeam];
                        const phase = team.phase;

                        if (phase.includes(currentPhase)) { // === phase.toLowerCase()) {
                            foundPhase = true;
                            outString += `### ${raidTeam} ### \n* Characters: ${team.characters.join(", ")}\n`;
                        }
                    }
                    if (foundPhase) {
                        return message.channel.send(outString, { code: 'md', split: true });
                    } else {
                        return message.channel.send(`Cannot find any teams under \`${currentPhase}\``).then(msg => msg.delete(10000)).catch(console.error);
                    }
                }
            }
        }

        if (found === false) {
            return message.channel.send(`Invalid raid, usage is \`${config.prefix}${this.help.usage}\`\n**Example:** \`${config.prefix}${this.help.example}\``).then(msg => msg.delete(10000)).catch(console.error);
        }
    } else {
        return message.channel.send(`Invalid raid, usage is \`${config.prefix}${this.help.usage}\`\n**Example:** \`${config.prefix}${this.help.example}\``).then(msg => msg.delete(10000)).catch(console.error);
    }

};

exports.conf = {
    guildOnly: false,
    enabled: true,
    aliases: ['raid', 'raidteam'],
    permLevel: 0
};

exports.help = {
    name: 'raidteams',
    category: 'Star Wars',
    description: 'Shows some teams that work well for each raid.',
    usage: 'raidteams <aat|pit> <p1|p2|p3|p4|solo>',
    example: ';raidteams aat p1',
    extended: `\`\`\`asciidoc
raid        :: The raid you want to look up the teams for. Ex: aat, haat, or pit.
phase       :: The phase you're wanting to look up. Ex: p1, p4, solo
    \`\`\``
};
