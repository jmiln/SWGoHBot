const Command = require('../base/Command');
const mysql = require('mysql');

class Zetas extends Command {
    constructor(client) {
        super(client, {
            name: 'zetas',
            category: "SWGoH",
            aliases: ['zeta']
        });
    }

    async run(client, message, [userID, ...args], level) { // eslint-disable-line no-unused-vars
        // Need to get the allycode from the db, then use that
        if (!userID || userID === "me") {
            userID = message.author.id;
        } else if (userID.match(/\d{17,18}/)) {
            userID = userID.replace(/[^\d]*/g, '');
        }

        let ally = await client.allyCodes.findOne({where: {id: userID}});
        if (!ally) {
            return message.channel.send(message.language.BASE_SWGOH_NOT_REG(client.users.get(userID).tag));
        }       
        const allyCode = ally.dataValues.allyCode;

        const lang = 'ENG_US';
        const zetaSql = `
        SELECT
        PlayerProfile.name as \`Name\`,
            udn.text as 'Character',
            abn.text as 'aName',
            abn.id as 'ID'

        FROM PlayerProfile
        JOIN Unit ON Unit.playerProfilePlayerId = PlayerProfile.playerId
        JOIN Skill ON Skill.unitId = Unit.id
        JOIN SkillTierDefinition ON SkillTierDefinition.skillDefinitionId = Skill.id

        JOIN UnitDef ON UnitDef.id = Unit.definitionId
        JOIN Localization udn ON udn.id = UnitDef.nameKey AND udn.language = '${lang}'

        JOIN SkillDefinition ON SkillDefinition.id = Skill.id
        JOIN Ability ON Ability.id = SkillDefinition.abilityReference
        JOIN Localization abn ON abn.id = Ability.nameKey AND abn.language = '${lang}'

        WHERE PlayerProfile.allyCode = ${allyCode}
        AND Skill.tier = 6
        AND SkillTierDefinition.powerOverrideTag = 'zeta';`;

        const connection = mysql.createConnection({
            host     : client.config.mySqlDB.host,
            user     : client.config.mySqlDB.user,
            password : client.config.mySqlDB.password,
            database : client.config.mySqlDB.database
        });
        connection.query(zetaSql, function(err, results) {
            const zetas = {};
            let name;
            if (results) {
                results.forEach(row => {
                    name = row.Name;
                    row.aName = `\`[${row.ID.toUpperCase()[0]}]\` ${row.aName}`;
                    if (zetas.hasOwnProperty(row.Character)) {
                        zetas[row.Character].push(row.aName);
                    } else {
                        zetas[row.Character] = [row.aName];
                    }
                });
                const fields = [];
                const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
                sorted.forEach(character => {
                    fields.push({
                        name: `(${zetas[character].length}) ${character}`,
                        value: zetas[character].join('\n') + '\n`' + '-'.repeat(30) + '`',
                        inline: true
                    })
                });
                const auth = message.guild.members.get(userID);
                message.channel.send({embed: {
                    color: 0x000000,
                    author: {
                        name: `${name}'s Zetas`,
                        icon_url: auth.user.avatarURL
                    },
                    description: message.language.COMMAND_ZETA_OUT_DESC, 
                    fields: fields
                }})
            }
        });

        connection.end();
    }
}

module.exports = Zetas;

