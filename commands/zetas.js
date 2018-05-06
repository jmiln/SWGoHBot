const Command = require('../base/Command');
const mysql = require('mysql');

class Zetas extends Command {
    constructor(client) {
        super(client, {
            name: 'zetas',
            guildOnly: true,
            category: "SWGoH",
            aliases: ['zeta'],
            permissions: ['EMBED_LINKS']
        });
    }

    async run(client, message, [userID, ...args], level) { // eslint-disable-line no-unused-vars
        // Need to get the allycode from the db, then use that
        if (!userID || userID === "me") {
            userID = message.author.id;
        } else if (userID.match(/\d{17,18}/)) {
            userID = userID.replace(/[^\d]*/g, '');
        }

        const ally = await client.allyCodes.findOne({where: {id: userID}});
        if (!client.users.get(userID)) {
            return message.channel.send(message.language.get('COMMAND_ZETA_NO_USER'));
        }
        if (!ally) {
            return message.channel.send(message.language.get('BASE_SWGOH_NOT_REG', client.users.get(userID).tag));
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
                let count = 0;
                results.forEach(row => {
                    name = row.Name;
                    row.Character = row.Character.replace(/"/g, '');
                    count += 1;
                    row.aName = `\`[${row.ID.toUpperCase()[0]}]\` ${row.aName.replace(/"/g, '')}`;
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
                    });
                });
                const auth = message.guild.members.get(userID);
                const author = {name: `${name}'s Zetas (${count})`};
                if (auth) {
                    author.icon_url = auth.user.avatarURL;
                } else {
                    author.name = `${client.users.get(userID).username}'s Zetas (${count})`;
                }
                let desc;
                if (fields.length === 0) {
                    desc = message.language.get('COMMAND_ZETA_NO_ZETAS');
                } else {
                    desc = message.language.get('COMMAND_ZETA_OUT_DESC');
                }
                message.channel.send({embed: {
                    color: 0x000000,
                    author: author,
                    description: desc, 
                    fields: fields
                }});
            }
        });

        connection.end();
    }
}

module.exports = Zetas;

