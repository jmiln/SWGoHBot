const Command = require('../base/Command');

class Raidteams extends Command {
    constructor(client) {
        super(client, {
            name: 'raidteams',
            aliases: ['raid', 'raidteam'],
            category: 'Star Wars'
        });
    }

    run(client, message, args) {
        const config = client.config;
        const guildConf = message.guildSettings;
        const raidList = client.teams;

        let currentPhase = "Phase 1";

        // Make sure the args are all there
        if (typeof args[0] === 'undefined' || args[0] === null || args[0] === "") {
            return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_INVALID_RAID', config.prefix));
        }
        if (typeof args[1] === 'undefined' || args[1] === null || args[1] === "") {
            return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_INVALID_PHASE', config.prefix));
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
                currentPhase = message.language.get('COMMAND_RAIDTEAMS_PHASE_SOLO');
            } else if (phaseName === "p1") {
                currentPhase = message.language.get('COMMAND_RAIDTEAMS_PHASE_ONE');
            } else if (phaseName === "p2") {
                currentPhase = message.language.get('COMMAND_RAIDTEAMS_PHASE_TWO');
            } else if (phaseName === "p3") {
                currentPhase = message.language.get('COMMAND_RAIDTEAMS_PHASE_THREE');
            } else if (phaseName === "p4") {
                currentPhase = message.language.get('COMMAND_RAIDTEAMS_PHASE_FOUR');
            } else {
                return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_INVALID_PHASE', config.prefix, this.help)).then(msg => msg.delete(10000)).catch(console.error);
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
                                    "value": message.language.get('COMMAND_RAIDTEAMS_CHARLIST', team.characters.join(", "))
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
                                    "title": message.language.get('COMMAND_RAIDTEAMS_SHOWING', currentPhase),
                                    "color": 2,
                                    "fields": fields,
                                    "footer": {
                                        "text": footerText
                                    }
                                }
                            });
                        } else {
                            return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_NO_TEAMS', currentPhase));
                        }
                    } else { // Embeds are disabled
                        let outString = message.language.get('COMMAND_RAIDTEAMS_CODE_TEAMS', raid.name, currentPhase);
                        for (var raidTeam in teams) {
                            const team = raid.teams[raidTeam];
                            const phase = team.phase;

                            if (phase.includes(currentPhase)) { // === phase.toLowerCase()) {
                                foundPhase = true;
                                outString += message.language.get('COMMAND_RAIDTEAMS_CODE_TEAMCHARS', raidTeam, team.characters.join(", "));
                            }
                        }
                        if (foundPhase) {
                            return message.channel.send(outString, { code: 'md', split: true });
                        } else {
                            return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_NO_TEAMS', currentPhase));
                        }
                    }
                }
            }

            if (found === false) {
                return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_INVALID_RAID', config.prefix));
            }
        } else {
            return message.channel.send(message.language.get('COMMAND_RAIDTEAMS_INVALID_PHASE', config.prefix));
        }
    }
}

module.exports = Raidteams;

