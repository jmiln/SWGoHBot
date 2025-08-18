import Language from "../base/Language.js";

const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: "Dom",
        LONG: "Domingo"
    },
    MONDAY: {
        SHORT: "Seg",
        LONG: "Segunda"
    },
    TUESDAY: {
        SHORT: "Ter",
        LONG: "Terça"
    },
    WEDNESDAY: {
        SHORT: "Qua",
        LONG: "Quarta"
    },
    THURSDAY: {
        SHORT: "Qui",
        LONG: "Quinta"
    },
    FRIDAY: {
        SHORT: "Sex",
        LONG: "Sexta"
    },
    SATURDAY: {
        SHORT: "Sáb",
        LONG: "Sábado"
    }
};
const TIMES = {
    DAY: {
        PLURAL: "dias",
        SING: "dia",
        SHORT_PLURAL: "ds",
        SHORT_SING: "d"
    },
    HOUR: {
        PLURAL: "horas",
        SING: "hora",
        SHORT_PLURAL: "hrs",
        SHORT_SING: "hr"
    },
    MINUTE: {
        PLURAL: "minutos",
SING: "minuto",
        SHORT_PLURAL: "mins",
        SHORT_SING: "min"
    },
    SECOND: {
        PLURAL: "segundos",
        SING: "segundo",
        SHORT_PLURAL: "segs",
        SHORT_SING: "seg"
    }
};

function getDay(day, type) {
    return DAYSOFWEEK[`${day}`][`${type}`];
}

function getTime(unit, type) {
    return TIMES[`${unit}`][`${type}`];
}

export default class extends Language {
    constructor(...args) {
        super(...args);

        this.getDay = getDay;
        this.getTime = getTime;
        this.language = {
            // Default in case it can't find one.
            BASE_DEFAULT_MISSING: "Tentativa de usar uma string inexistente. Se você receber esta mensagem, por favor avise para que seja consertado.",

            // Base swgohBot.js file
            BASE_LAST_EVENT_NOTIFICATION: "\n\nEsta é a última ocorrência desse evento. Para continuar recebendo este alerta, crie um novo evento.",
            BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nComeçando em ${timeToGo}`,

            // Base swgohAPI
            BASE_SWGOH_NO_ALLY: "Desculpe-me, mas o usuário não está registrado. Por favor faça o registro utilizando o comando `;register add <user> <código de aliança>`",
            BASE_SWGOH_NOT_REG: (user) => `Desculpe-me, mas o usuário não está registrado. Por favor faça o registro utilizando o comando \`;register add @${user} <código de aliança>\``,
            BASE_SWGOH_NO_USER: "Desculpe-me, mas não tenho esse usuário listado em nenhum lugar.",
            BASE_SWGOH_MISSING_CHAR: "Você precisa dizer qual personagem quer verificar",
            BASE_SWGOH_NO_CHAR_FOUND: (character) => `Não encontrei resultados para o personagem ${character}`,
            BASE_SWGOH_CHAR_LIST: (chars) => `Sua busca retornou muitos resultados, por favor seja mais específico. \nSegue uma lista dos resultados mais próximos.\n\`\`\`${chars}\`\`\``,
            BASE_SWGOH_NO_ACCT: "Algo deu errado, por favor verifique se sua conta está sincronizada corretamente.",
            BASE_SWGOH_LAST_UPDATED: (date) => `Última atualização na ${date} passada`,
            BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `Por favor, aguarde enquanto eu recupero seu(s) ${dType ? dType : "dados"}`,

            // Generic (Not tied to a command)
            COMMAND_EXTENDED_HELP: (command) => `**Ajuda extendida para ${command.help.name}** \n**Uso**: ${command.help.usage} \n${command.help.extended}`,
            COMMAND_INVALID_BOOL: "Valor inválido, tente true ou false",
            COMMAND_MISSING_PERMS: "Desculpe-me, você não tem as permissões corretas para executar esta ação.",
            BASE_COMMAND_UNAVAILABLE: "Este comando está indisponível através de mensagem privada. Por favor, execute este comando em uma guilda.",
            BASE_COMMAND_HELP_HEADER: (name) => `Ajuda para ${name}`,
            BASE_COMMAND_HELP_HEADER_CONT: (name) => `Mais ajuda para ${name}`,
            BASE_COMMAND_HELP_HELP: (name) => {
                return {
                    action: "Exibir ajuda",
                    actionDesc: "Exibe esta mensagem",
                    usage: `;${name} help`,
                    args: {}
                };
            },
            BASE_MOD_TYPES: {
                SQUARE:  "Quadrado",
                ARROW:   "Seta",
                DIAMOND: "Diamante",
                TRIANGLE:"Triângulo",
                CIRCLE:  "Círculo",
                CROSS:   "Cruz",
                ACCURACY:   "Precisão",
                CRITCHANCE: "Chance de Acerto Crítico",
                CRITDAMAGE: "Dano de Acerto Crítico",
                DEFENSE:    "Defesa",
                HEALTH:     "Saúde",
                OFFENSE:    "Ataque",
                POTENCY:    "Potência",
                SPEED:      "Velocidade",
                TENACITY:   "Tenacidade"
            },

            // Abilities Command
            COMMAND_ABILITIES_NEED_CHARACTER: (prefix) => `Necessário informar um personagem. Use \`${prefix}abilities <nome do personagem>\``,
            COMMAND_ABILITIES_INVALID_CHARACTER: (prefix) => `Personagem inválido. Use \`${prefix}abilities <nome do personagem>\``,
            COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Recarga da Habilidade:** ${aCooldown}\n`,
            COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Tipo da Habilidade:** ${aType}     **Material necessário para nível máximo da habilidade:**  ${mat}\n${cdString}${aDesc}`,
            COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* Tipo da habilidade: ${type}\n* Material necessário para nível máximo da habilidade: ${tier}\n* Descrição: ${aDesc}\n\n`,
            COMMAND_ABILITIES_HELP: {
                description: "Exibe as habilidades do personagem.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";abilities <nome do personagem>",
                        args: {}
                    }
                ]
            },

            // Activities Command
            COMMAND_ACTIVITIES_SUNDAY: "== Antes do Reset == \nComplete as Batalhas da Arena \nGuarde Energia da Catina \nGuarde Energia Comum\n\n== Após o Reset == \nGaste Energia da Catina \nGuarde Energia Comum",
            COMMAND_ACTIVITIES_MONDAY: "== Antes do Reset == \nGaste Energia da Catina \nGuarde Energia Comum \n\n== Após o Reset == \nGaste Energia Comum em Batalhas do Lado da Luz ",
            COMMAND_ACTIVITIES_TUESDAY: "== Antes do Reset == \nGaste Energia Comum em Batalhas do Lado da Luz \nGuarde os Outros Tipos de Energia\n\n== Após o Reset == \nGaste Todos os Tipos de Energia Exceto Energia Comum \nGuarde Energia Comum",
            COMMAND_ACTIVITIES_WEDNESDAY: "== Antes do Reset == \nGaste Todos os Tipos de Energia Exceto Energia Comum \nGuarde Energia Comum\n\n== Após o Reset == \nGaste Energia Comum com Batalhas Difíceis",
            COMMAND_ACTIVITIES_THURSDAY: "== Antes do Reset == \nGaste Energia Comum com Batalhas Difíceis \nGuarde os Desafios\n\n== Após o Reset == \nComplete os Desafios \nGuarde Energia Comum",
            COMMAND_ACTIVITIES_FRIDAY: "== Antes do Reset == \nComplete os Desafios \nGuarde Energia Comum\n\n== Após o Reset == \nGaste Energia Comum em Batalhas do Lado Sombrio",
            COMMAND_ACTIVITIES_SATURDAY: "== Antes do Reset == \nGaste Energia Comum em Batalhas do Lado Sombrio \nGuarde as Batalhas da Arena \nGuarde Energia da Catina\n\n== Após o Reset == \nComplete as Batalhas da Arena \nGuarde Energia da Cantina",
            COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Dia inválido, use \`${prefix}${usage}\``,
            COMMAND_ACTIVITIES_HELP: {
                description: "Exibe as atividades diárias de guilda.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";activities [dia da semana]",
                        args: {}
                    }
                ]
            },

            // Arenarank Command
            COMMAND_ARENARANK_INVALID_NUMBER: "Você deve inserir um número de ranking válido.",
            COMMAND_ARENARANK_BEST_RANK: "Você atingiu o melhor ranking possível, parabéns!",
            COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `A partir da posição ${currentRank}, com ${battleCount} batalha${plural} ${est}\nA melhor posição que você pode atingir é ${rankList}`,
            COMMAND_ARENARANK_HELP: {
                description: "Exibe a melhor colocação (aproximada) que você pode alcançar se vencer todas as batalhas na arena.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";arenarank <posição atual> [número de batalhas]",
                        args: {}
                    }
                ]
            },

            // Challenges Command
            COMMAND_CHALLENGES_TRAINING: "Droides de Treinamento",
            COMMAND_CHALLENGES_ABILITY : "Materiais de Habilidade",
            COMMAND_CHALLENGES_BOUNTY  : "Caçador de Recompensas",
            COMMAND_CHALLENGES_AGILITY : "Equipamento de AGI",
            COMMAND_CHALLENGES_STRENGTH: "Equipamento de FOR",
            COMMAND_CHALLENGES_TACTICS : "Equipamento de TAT",
            COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "Droides de Aprimoramente de Naves",
            COMMAND_CHALLENGES_SHIP_BUILDING   : "Materiais de Construção de Naves",
            COMMAND_CHALLENGES_SHIP_ABILITY    : "Materiais de Habilidade de Naves",
            COMMAND_CHALLENGES_MISSING_DAY: "Você deve especificar um dia",
            COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `Dia inválido, uso correto: \`${prefix}${usage}\``,
            COMMAND_CHALLENGES_HELP: {
                description: "Exibe os desafios diários.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";challenges <dia da semana>",
                        args: {}
                    }
                ]
            },

            // Changelog Command (Help)
            COMMAND_CHANGELOG_HELP: {
                description: "Adiciona um registro de mudança ao banco de dados e o envia para o canal de registro de mudanças.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "changelog <message>",
                        args: {
                            "message": "Use [Updated], [Fixed], [Removed] e [Added] para organizar o registro de mudanças."
                        }
                    }
                ]
            },

            // Character gear Command
            COMMAND_CHARGEAR_NEED_CHARACTER: (prefix) => `Necessita um personagem. Uso correto é \`${prefix}charactergear <personagem> [nível de equipamento]\``,
            COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix) => `Personagem inválido. Uso correto é \`${prefix}charactergear <personagem> [nível de equipamento]\``,
            COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### Todo Equipamento Necessário ### \n${gearString}`,
            COMMAND_CHARGEAR_GEAR_NA: "Este equipamento ainda não foi inserido",
            COMMAND_CHARACTERGEAR_HELP: {
                description: "Exibe os requisitos de equipamento para um determinado personagem/nível.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "charactergear <personagem> [nível de equipamento]",
                        args: {}
                    }
                ]
            },

            // Command Report Command
            COMMAND_COMMANDREPORT_HELP: ({
                description: "Exive a lista de todos os comandos que foram executados nos últimos 10 dias.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";commandreport",
                        args: {}
                    }
                ]
            }),

            // Current Events Command
            COMMAND_CURRENTEVENTS_HEADER: "SWGoH Calendário de Eventos",
            COMMAND_CURRENTEVENTS_DESC: (num) => `Próximos ${num} eventos.\nNote: *Datas estão sujeitas a mudança.*`,
            COMMAND_CURRENTEVENTS_HELP: {
                description: "Exibe os próximos eventos.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";currentevents [num]",
                        args: {
                            "num": "O número máximo de eventos que você quer exibir."
                        }
                    }
                ]
            },

            // Event Command (Create)
            COMMAND_EVENT_INVALID_ACTION: (actions) => `Ações válidas são \`${actions}\`.`,
            COMMAND_EVENT_INVALID_PERMS: "Desculpe-me, mas ou você não é um administrador ou o líder do servidor não realizou a configuração do bot.\n Você não pode adicionar ou remover eventos a não ser que você tenha configurado a permissão de administrador.",
            COMMAND_EVENT_ONE_REPEAT: "Desculpe-me, mas você não pode utilizar as opções `repeat` e `repeatDay` ao mesmo tempo em um evento. Por favor, utiliza apenas uma das opções",
            COMMAND_EVENT_INVALID_REPEAT: "A repetição está em formato inválido. Exemplo: `5d3h8m` para 5 dias, 3 horas e 8 minutos",
            COMMAND_EVENT_USE_COMMAS: "Por favor, use uma lista separada por virgulas para o repeatDay. Exemplo: `1,2,1,3,4`",
            COMMAND_EVENT_INVALID_CHAN: "Esse canal é inválido, por favor tente novamente",
            COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `Eu não tenho permissão para enviar mensagens no canal ${channel}, por favor escolha um canal em que eu tenha permissão`,
            COMMAND_EVENT_NEED_CHAN: "ERRO: é preciso que seja configurada um canal para o envio de eventos. Configure `announceChan` para conseguir agendar eventos.",
            COMMAND_EVENT_NEED_NAME: "Você precisa dar um nome para seu evento.",
            COMMAND_EVENT_EVENT_EXISTS: "Esse nome já existe. Não é possível adicioná-lo novamente.",
            COMMAND_EVENT_NEED_DATE: "Você precisa dar uma data para seu evento. O formato aceito é `DD/MM/YYYY`.",
            COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate} não é uma data válida. O formato aceito é \`DD/MM/YYYY\`.`,
            COMMAND_EVENT_NEED_TIME: "Você deve dar um horário para seu evento.",
            COMMAND_EVEMT_INVALID_TIME: "Você deve dar um horário válido para seu evento. O formato aceito é `HH:MM`, usando um formato de relógio de 24 horas. Não utilize AM ou PM",
            COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `Você não pode configurar um evento no passado. ${eventDATE} ocorre antes de ${nowDATE}`,
            COMMAND_EVENT_CREATED: (eventName, eventDate) => `Evento \`${eventName}\` agendado para ${eventDate}`,
            COMMAND_EVENT_NO_CREATE: "Eu não consegui criar este evento, por favor tente novamente.",
            COMMAND_EVENT_TOO_BIG:(charCount) => `Descuple-me, mas o nome ou o texto do seu evento é muito longo. Por favor, reduza ele a pelo menos ${charCount} letras.`,

            // Event Command (View)
            COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \nHora do Evento: ${eventDate}\n`,
            COMMAND_EVENT_TIME_LEFT: (timeLeft) => `Tempo restante: ${timeLeft}\n`,
            COMMAND_EVENT_CHAN: (eventChan) => `Canal destino: ${eventChan}\n`,
            COMMAND_EVENT_SCHEDULE: (repeatDays) => `Repetição: ${repeatDays}\n`,
            COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `Repetindo-se a cada ${eventDays} dias, ${eventHours} horas e ${eventMins} minutos\n`,
            COMMAND_EVENT_MESSAGE: (eventMsg) => `Mensagem do Evento: \n\`\`\`md\n${eventMsg}\`\`\``,
            COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `Desculpe-me, mas não localizei o evento \`${eventName}\``,
            COMMAND_EVENT_NO_EVENT: "Atualmente não há eventos agendados.",
            COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `Aqui está a agenda de eventos do seu servidor: \n(${eventCount} total de evento${eventCount > 1 ? "s" : ""}) Exibindo página ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`,
            COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `Aqui está a agenda de eventos do seu servidor \n(${eventCount} total de evento${eventCount > 1 ? "s" : ""}): \n${eventKeys}`,

            // Event Command (Delete)
            COMMAND_EVENT_DELETE_NEED_NAME: "Você deve dar um nome de evento para remove-lo.",
            COMMAND_EVENT_DOES_NOT_EXIST: "Este evento não existe.",
            COMMAND_EVENT_DELETED: (eventName) => `Evento removido: ${eventName}`,

            // Event Command (Trigger)
            COMMAND_EVENT_TRIGGER_NEED_NAME: "Você deve dar o nome de um evento para dispará-lo.",

            // Event Command (Help)
            COMMAND_EVENT_HELP: {
                description: "Usado para criar, verificar, ou apagar um evento.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Cria um novo evento",
                        usage: ";event create <nome do evento> <dia do evento> <hora do evento> [mensagem do evento]",
                        args: {
                            "--repeat <repeatTime>": "Possibilita que você configure o tempo após o qual o evento irá se repetir, no formato 00d00h00m.",
                            "--repeatDay <schedule>": "Possibilita que você configure um conjunto de dias nos quais o evento irá se repetir no formato: 0,0,0,0,0.",
                            "--channel <channelName>": "Possibilita que você especifique o canal no qual a mensagem do evento será enviada.",
                            "--countdown": "Adiciona um contador que enviará mensagens alertando da proximidade do início do evento."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Lista os seus eventos agendados.",
                        usage: ";event view [nome do evento]",
                        args: {
                            "--min": "Omite a mensagem do evento da listagem",
                            "--page <# da página>": "Possibilita que você seleciona o númer da página para visualizar"
                        }
                    },
                    {
                        action: "Delete",
                        actionDesc: "Remove um evento.",
                        usage: ";event delete <nome do evento>",
                        args: {}
                    },
                    {
                        action: "Trigger",
                        actionDesc: "Dispara um evento no canal especificado sem desagendar o evento.",
                        usage: ";event trigger <nome do evento>",
                        args: {}
                    }
                ]
            },

            // Faction Command
            COMMAND_FACTION_INVALID_CHAR: (prefix) => `Facção inválida. Uso correto: \`${prefix}faction <faction>\``,
            COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# Personagens pertencentes à facção ${searchName} # \n${charString}`,
            COMMAND_FACTION_HELP: {
                description: "Exibe a lista de personagens pertencentes à facção especificada.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "faction <facção>",
                        args: {
                            "faction": "O nome da facção que você deseja pesquisar. \nTenha em mente que é o nome da facção conforme descrito no jogo, então deve ser usado 'rebel' ao invés de rebels ou rebeldes"
                        }
                    }
                ]
            },

            // Guilds Command
            COMMAND_GUILDS_MORE_INFO: "Para mais informação em uma guilda específica:",
            COMMAND_GUILDS_HELP: {
                description: "Exibe as melhores guildas e todo mundo que está registrado na sua guilda.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guild [user]",
                        args: {
                            "user": "Uma forma de identificar a guilda. (menção | código de aliança | nome da guilda)"
                        }
                    }
                ]
            },

            // GuildSearch Command
            COMMAND_GUILDSEARCH_BAD_STAR: "Você só pode escolher um nível de estrelas entre 1 e 7",
            COMMAND_GUILDSEARCH_MISSING_CHAR: "Você precisa fornecer o nome de um personagem para procurar",
            COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `Nenhum resultado encontrado para o personagem ${character}`,
            COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `A sua busca retornou muitos resultados, Por favor, seja mais específico. \nSegue uma lista dos resultados mais próximos.\n\`\`\`${chars}\`\`\``,
            COMMAND_GUILDSEARCH_FIELD_HEADER: (tier, num, setNum="") => `${tier} Estrelas (${num}) ${setNum.length > 0 ? setNum : ""}`,
            COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `Ninguém na sua guilda parece ter esse personagem com ${starLvl} estrelas.`,
            COMMAND_GUILDSEARCH_NO_CHAR: "Ninguém na sua guilda parece ter esse personagem.",
            COMMAND_GUILDSEARCH_HELP: {
                description: "Exibe o nível de estrelas do personagem escolhido de todo mundo da guilda.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guildsearch [user] <character> [-ships] [starLvl]",
                        args: {
                            "user": "Pessoa membra da gulda que será buscar (me | userID | mention)",
                            "character": "O nome do personagem que você deseja buscar.",
                            "-ships": "Buscar por naves, você pode usar `-s, -ship ou -ships`",
                            "starLvl": "Selecione o nível de estrelas que você deseja consultar."
                        }
                    }
                ]
            },

            // Heists Command
            COMMAND_HEISTS_HEADER: "SWGoH Heists Schedule",
            COMMAND_HEISTS_CREDIT: (date) => `**Credits** : ${date}\n`,
            COMMAND_HEISTS_DROID: (date) => `**Droids**  : ${date}\n`,
            COMMAND_HEISTS_NOT_SCHEDULED: "`Not scheduled`",
            COMMAND_HEISTS_HELP: {
                description: "Exibe os próximos eventos roubos de créditos/contrabando de droides agendados.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";heists",
                        args: {}
                    }
                ]
            },


            // Help Command
            COMMAND_HELP_HEADER: (prefix) => `= Lista de Comandos =\n\n[Use ${prefix}help <nome do comando> para detalhes]\n`,
            COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nApelidos:: ${command.conf.aliases.join(", ")}\nUso:: ${prefix}${command.help.usage}`,
            COMMAND_HELP_HELP: {
                description: "Exibe informação dos comandos disponíveis.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";help [command]",
                        args: {
                            "command": "O comando sobre o qual você deseja obter mais informações."
                        }
                    }
                ]
            },

            // Info Command
            COMMAND_INFO_OUTPUT: (guilds) => ({
                "header": "INFORMAÇÃO",
                "desc": ` \nAtualmente executando em **${guilds}** servidores \n`,
                "links": {
                    "Invite me": "Convide o bot http://swgohbot.com/invite",
                    "Support Server": "Se você tem alguma dúvida, sugestão ou apenas quiser conversar, o servidor discord de suporte do bot é: https://discord.gg/FfwGvhr",
                    "Support the Bot": "O código fonte do bot está disponível em github https://github.com/jmiln/SWGoHBot, e está aberto para contribuições. \n\nConta de Patreon disponível em https://www.patreon.com/swgohbot se você estiver interessado."
                }
            }),
            COMMAND_INFO_HELP: {
                description: "Mostra links úteis relacionados ao bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "info",
                        args: {}
                    }
                ]
            },

            COMMAND_MODS_CRIT_CHANCE_SET: "Chance de Acerto Crítico x2",
            COMMAND_MODS_CRIT_DAMAGE_SET: "Dano de Acerto Crítico x4",
            COMMAND_MODS_SPEED_SET: "Velocidade x4",
            COMMAND_MODS_TENACITY_SET: "Tenacidade x2",
            COMMAND_MODS_OFFENSE_SET: "Ataque x4",
            COMMAND_MODS_POTENCY_SET: "Potência x2",
            COMMAND_MODS_HEALTH_SET: "Saúde x2",
            COMMAND_MODS_DEFENSE_SET: "Defesa x2",
            COMMAND_MODS_EMPTY_SET: " ",

            COMMAND_MODS_ACCURACY_STAT: "Precisão",
            COMMAND_MODS_CRIT_CHANCE_STAT: "Chance de Acerto Crítico",
            COMMAND_MODS_CRIT_DAMAGE_STAT: "Dano de Acerto Crítico",
            COMMAND_MODS_DEFENSE_STAT: "Defesa",
            COMMAND_MODS_HEALTH_STAT: "Saúde",
            COMMAND_MODS_OFFENSE_STAT: "Ataque",
            COMMAND_MODS_PROTECTION_STAT: "Proteção",
            COMMAND_MODS_POTENCY_STAT: "Potência",
            COMMAND_MODS_SPEED_STAT: "Velocidade",
            COMMAND_MODS_TENACITY_STAT: "Tenacidade",
            COMMAND_MODS_UNKNOWN: "Desconhecido",

            // Mods Command
            COMMAND_MODS_NEED_CHARACTER: (prefix) => `Necessita de um personagem. Uso correto é \`${prefix}mods <nome de personagem>\``,
            COMMAND_MODS_INVALID_CHARACTER: (prefix) => `Personagem inválido. Uso correto é \`${prefix}mods <nome de personagem>\``,
            COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) =>  `\`Quadrado:  ${square}\`\n\`Seta:      ${arrow}\`\n\`Diamante:  ${diamond}\`\n`,
            COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Triângulo: ${triangle}\`\n\`Círculo:   ${circle}\`\n\`Cruz:      ${cross}\`\n`,
            COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### Conjuntos ###**\n${modSetString}\n**### Atributos Primários ###**\n${modPrimaryString}`,
            COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) =>  `* Quadrado:   ${square}  \n* Seta:       ${arrow} \n* Diamante:   ${diamond}\n`,
            COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Triângulo:  ${triangle}\n* Círculo:    ${circle}\n* Cruz:       ${cross}`,
            COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### Conjuntos ### \n${modSetString}\n### Atributos Primários ###\n${modPrimaryString}`,
            COMMAND_NO_MODSETS: "Nenhum conjunto de modificadores definidos para esse personagem.",
            COMMAND_MODS_HELP: {
                description: "Exibe modificadores sugeridos para um personagem especificado.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "mods <character>",
                        args: {
                            "character": "O personagem para o qual você quer sugestões de modificadores."
                        }
                    }
                ]
            },

            // Modsets command
            COMMAND_MODSETS_OUTPUT: "* Critical Chance:  2\n* Critical Damage:  4\n* Defense:  2\n* Health:   2\n* Offense:  4\n* Potency:  2\n* Speed:    4\n* Tenacity: 2",
            COMMAND_MODSETS_HELP: {
                description: "Shows how many of each kind of mod you need for a set.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "modsets",
                        args: {}
                    }
                ]
            },

            // MyArena Command
            COMMAND_MYARENA_NO_USER: (user) => `Desculpe-me, mas não consigo encontrar os dados da arena do usuário ${user}. Por favor, verifique se a conta está sincronizada`,
            COMMAND_MYARENA_NO_CHAR: "Algo deu errado, não consigo recuperar seus personagens.",
            COMMAND_MYARENA_ARENA: (rank) => `Arena de Personagens (Rank: ${rank})`,
            COMMAND_MYARENA_FLEET: (rank) => `Arena de Naves (Rank: ${rank})`,
            COMMAND_MYARENA_EMBED_HEADER: (playerName) => `Arena de ${playerName}`,
            COMMAND_MYARENA_EMBED_FOOTER: (date) => `Dados da Arena referentes a: ${date}`,
            COMMAND_MYARENA_HELP: {
                description: "Mostra a posição corrente do usuário na arena e seus times\\esquadrões.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myarena [user]",
                        args: {
                            "user": "A pessoa para a qual você deseja saber a posição na arena. (me | userID | mention)"
                        }
                    }
                ]
            },

            // MyCharacter Command
            COMMAND_MYCHARACTER_HELP: ({
                description: "Mostra informações sobre o personagem especificado.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mycharacter [user] <character>",
                        args: {
                            "user": "A pessoa dona do personagem. (me | userID | mention)",
                            "character": "O personagem para o qual você deseja obter mais informações."
                        }
                    }
                ]
            }),

            // MyMods Command
            COMMAND_MYMODS_NO_MODS: (charName) => `Desculpe-me, mas não consegui encontrar nenhum modificador para o personagem ${charName}`,
            COMMAND_MYMODS_MISSING_MODS: "Desculpe-me, não consigo encontrar seus mods. Por favor, aguarde um pouco e tente novamente.",
            COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `Modificadores atualizados pela última vez em: ${lastUpdated}`,
            COMMAND_MYMODS_HELP: ({
                description: "Exibe os mods que você tem equipado em um dado personagem.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mymods [user] <character>",
                        args: {
                            "user": "A pessoa dona do personagem. (me | userID | mention)",
                            "character": "O personagem para o qual você deseja obter informação dos mods."
                        }
                    }
                ]
            }),

            // MyProfile Command
            COMMAND_MYPROFILE_NO_USER: (user) => `Desculpe-me, mas não consigo encontrar os dados da arena do usuário ${user}. Por favor, verifique se sua conta está sincronizada`,
            COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `Perfil de ${playerName} (${allyCode})`,
            COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `Dados da Arena obtidos em: ${date}`,
            COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank) => `**Guilda:** ${guildName}\n**Nível:** ${level}\n**Posição na Arena:** ${charRank}\n**Posição na Arena das Naves:** ${shipRank}`,
            COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount) => ({
                header: `Characters (${charList.length})`,
                stats: [
                    `GP dos personagens  :: ${gpChar}`,
                    `Quantidade de personagens com 7 Estrelas   :: ${charList.filter(c => c.rarity === 7).length}`,
                    `Quantidade de personagens com nível 85   :: ${charList.filter(c => c.level === 85).length}`,
                    `Quantidade de personagens com equipamento nível 12  :: ${charList.filter(c => c.gear === 12).length}`,
                    `Quantidade de personagens com equipamento nível 11  :: ${charList.filter(c => c.gear === 11).length}`,
                    `Número de Zetas    :: ${zetaCount}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
                header: `Ships (${shipList.length})`,
                stats: [
                    `GP das NaVES :: ${gpShip}`,
                    `Quantidade de naves com 7 Estrelas  :: ${shipList.filter(s => s.rarity === 7).length}`,
                    `Quantidade de naves com nível 85  :: ${shipList.filter(s => s.level === 85).length}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_HELP: {
                description: "Exibe informações gerais de um jogador.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myprofile [user]",
                        args: {
                            "user": "Nome do jogador para o qual você quer informações gerais. (me | userID | mention)"
                        }
                    }
                ]
            },

            // Nickname Command
            COMMAND_NICKNAME_SUCCESS: "Meu apelido mudou.",
            COMMAND_NICKNAME_FAILURE: "Desculpe-me, mas não tenho permissão para modificar isso.",
            COMMAND_NICKNAME_TOO_LONG: "Desculpe-me, mas um nome só pode conter no máximo 32 letras.",
            COMMAND_NICKNAME_HELP: {
                description: "Muda o apelido do bot no seu servidor.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";nickname <name>",
                        args: {
                            "name": "O nome para o qual você quer mudar. Deixe em branco para o nome padronizado."
                        }
                    }
                ]
            },

            // Polls Command
            COMMAND_POLL_NO_ARG: "Você deve escolher uma opção para votar ou uma ação (create/view/etc).",
            COMMAND_POLL_ALREADY_RUNNING: "Desculpe-me, mas você só pode rodar uma pesquisa por vez. Por favor, finalize a pesquisa que está em andamento antes.",
            COMMAND_POLL_MISSING_QUESTION: "Você precisa especificar uma opção de voto.",
            COMMAND_POLL_TOO_FEW_OPT: "Você precisa especificar pelo menos 2 opções de voto.",
            COMMAND_POLL_TOO_MANY_OPT: "Você pode ter no máximo 10 opções de voto.",
            COMMAND_POLL_CREATED: (name, prefix, poll) => `**${name}** iniciou uma nova pesquisa:\nVote usando o comando \`${prefix}poll <opção>\`\n\n${poll}`,
            COMMAND_POLL_NO_POLL: "Não há nenhuma pesquisa em andamento",
            COMMAND_POLL_FINAL: (poll) => `Resultado final da pesquisa ${poll}`,
            COMMAND_POLL_FINAL_ERROR: (question) => `Não consegui remover **${question}**, por favor tente novamente.`,
            COMMAND_POLL_INVALID_OPTION: "Essa não é uma opção válida.",
            COMMAND_POLL_SAME_OPT: (opt) => `Você já escolheu a opção **${opt}**`,
            COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `Você mudou sua opção de **${oldOpt}** para **${newOpt}**`,
            COMMAND_POLL_REGISTERED: (opt) => `Opção para **${opt}** registrada`,
            COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice}: **${optCount} voto${optCount === 1 ? "" : "s"}**\n`,
            COMMAND_POLL_HELP: {
                description: "Possibilitação a criação de pesquisas com múltiplas opções.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Cria uma nova pesquisa",
                        usage: ";poll create <question> | <opt1> | <opt2> | [...] | [opt10]",
                        args: {
                            "question": "A questão para a qual você deseja feedback.",
                            "opt": "As opções que as pessoas podem escolher"
                        }
                    },
                    {
                        action: "Vote",
                        actionDesc: "Vota na opção que você escolheu",
                        usage: ";poll <choice>",
                        args: {
                            "choice": "A opção que você escolheu."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Exibe o resultado parcial da pesquisa.",
                        usage: ";poll view",
                        args: {}
                    },
                    {
                        action: "Close",
                        actionDesc: "Encerra a pesquisa e exibe os resultados finais.",
                        usage: ";poll close",
                        args: {}
                    }
                ]
            },

            // Raidteams Command
            COMMAND_RAIDTEAMS_INVALID_RAID: (prefix) => `Ofensiva invalida, utilize \`${prefix}raidteams <ofensiva> <fase>\`\n**Exemplo:** \`${prefix}raidteams pit p3\``,
            COMMAND_RAIDTEAMS_INVALID_PHASE: (prefix) => `Fase inválida, utilize \`${prefix}raidteams <ofensiva> <fase>\`\n**Exemplo:** \`${prefix}raidteams pit p3\``,
            COMMAND_RAIDTEAMS_PHASE_SOLO: "Solo",
            COMMAND_RAIDTEAMS_PHASE_ONE: "Fase 1",
            COMMAND_RAIDTEAMS_PHASE_TWO: "Fase 2",
            COMMAND_RAIDTEAMS_PHASE_THREE: "Fase 3",
            COMMAND_RAIDTEAMS_PHASE_FOUR: "Fase 4",
            COMMAND_RAIDTEAMS_CHARLIST: (charList) => `**Personagens:** \`${charList}\``,
            COMMAND_RAIDTEAMS_SHOWING: (currentPhase) => `Exibindo times para ${currentPhase}`,
            COMMAND_RAIDTEAMS_NO_TEAMS: (currentPhase) => `Não foi possível encontrar nenhum time para \`${currentPhase}\``,
            COMMAND_RAIDTEAMS_CODE_TEAMS: (raidName, currentPhase) => ` * ${raidName} * \n\n* Exibindo times para ${currentPhase}\n\n`,
            COMMAND_RAIDTEAMS_CODE_TEAMCHARS: (raidTeam, charList) => `### ${raidTeam} ### \n* Personagens: ${charList}\n`,
            COMMAND_RAIDTEAMS_HELP: {
                description: "Exibe times que tem bom desempenho bem nas raids.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";raidteams <raid> <phase>",
                        args: {
                            "raid": "A raid para a qual você deseja ajuda. (aat|pit|sith)",
                            "phase": "A fase da raid para a qual você deseja ajuda (p1|p2|p3|p4|solo)"
                        }
                    }
                ]
            },

            // Randomchar Command
            COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `Desculpe-me, mas você deve inserir um número entre 1 e ${maxChar}.`,
            COMMAND_RANDOMCHAR_HELP: {
                description: "Seleciona até 5 personagens aleatórios para montar um time.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";randomchar [numberOfChars]",
                        args: {
                            "numberOfChars": "O número de personagens que você deseja no time"
                        }
                    }
                ]
            },

            // Register Command
            COMMAND_REGISTER_MISSING_ARGS: "Você deve fornecer um userID (mention ou ID), e um código de aliança",
            COMMAND_REGISTER_MISSING_ALLY: "Você deve fornecer um código de aliança para ligar sua conta.",
            COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `Desculpe-me, mas ${allyCode} não é um código de aliança válido`,
            COMMAND_REGISTER_PLEASE_WAIT: "Por favor, aguarde enquanto eu sincronizo seus dados.",
            COMMAND_REGISTER_FAILURE: "Registration failed, please make sure your ally code is correct.",
            COMMAND_REGISTER_SUCCESS: (user) => `Registro do usuário \`${user}\` realizado com sucesso!`,
            COMMAND_REGISTER_UPDATE_FAILURE: "Algo deu errado, certifique-se que seu código de aliança registrado está correto",
            COMMAND_REGISTER_UPDATE_SUCCESS: (user) => `Perfil de \`${user}\` atualizado.`,
            COMMAND_REGISTER_GUPDATE_SUCCESS: (guild) => `Guilda \`${guild}\` atualizada.`,
            COMMAND_REGISTER_HELP: {
                description: "Relaciona seu código de aliança com seu ID Discord, e sincroniza seu perfil SWGoH.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: "Relaciona seu perfil Discord com sua conta SWGoH",
                        usage: ";register add <user> <allyCode>",
                        args: {
                            "user": "A pessoa que você está adicionando. (me | userID | mention)",
                            "allyCode": "Seu código de aliança."
                        }
                    },
                    {
                        action: "Update",
                        actionDesc: "Atualiza/Resincroniza os dados do seu perfil SWGoH",
                        usage: ";register update <user> [-guild]",
                        args: {
                            "user": "A pessoa que você está adicionando. (me | userID | mention)",
                            "-guild": "Atualiza sua guilda inteira (-g | -guild | -guilds)"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: "Desvincula seu perfil Discord de sua conta SWGoH",
                        usage: ";register remove <user>",
                        args: {
                            "user": "Nome do usuário que terá sua conta desvinculada. (me | userID | mention)"
                        }
                    }
                ]
            },



            // Reload Command
            COMMAND_RELOAD_INVALID_CMD: (cmd) => `Eu não consegui localizar o comando: ${cmd}`,
            COMMAND_RELOAD_SUCCESS: (cmd) => `Comando recarregado com sucesso: ${cmd}`,
            COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `Falha ao recarregar o comando: ${cmd}\n\`\`\`${stackTrace}\`\`\``,
            COMMAND_RELOAD_HELP: {
                description: "Recarrega o comando, caso ele tenha sido atualizado.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";reload <command>",
                        args: {
                            "command": "Nome do comando que será recarregado."
                        }
                    }
                ]
            },

            // Reload Data Command
            COMMAND_RELOADDATA_HELP: {
                description: "Recarrega o(s) arquivo(s) selecionado(s).",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";reloaddata <option>",
                        args: {
                            "option": "O que você deseja que seja recarregado ( commands | data | events | function )."
                        }
                    }
                ]
            },

            // Setconf Command
            COMMAND_SETCONF_MISSING_PERMS: "Descuple-me, mas ou você não é um administrador, ou o administrador do seu servidor não realizou as configurações.",
            COMMAND_SETCONF_MISSING_OPTION: "Você deve escolher uma opção de configuração para modificá-la.",
            COMMAND_SETCONF_MISSING_VALUE: "Você deve fornecer o valor para a opção que está modificando.",
            COMMAND_SETCONF_ARRAY_MISSING_OPT: "Você deve usar os argumentos `add` ou `remove`.",
            COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `Desculpe-me, mas \`${value}\` não está configurado em \`${key}\`.`,
            COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${value}\` foi ${action} no seu \`${key}\`.`,
            COMMAND_SETCONF_NO_KEY: (prefix) => `Essa chave não está na configuração. Execute "${prefix}showconf" ou "${prefix}setconf help" para uma lista de valores possíveis`,
            COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `Item de configuração da guilda ${key} foi modificado para:\n\`${value}\``,
            COMMAND_SETCONF_NO_SETTINGS: "Nenhuma configuração de guilda encontrada.",

            COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `Você deve escolher um cargo para ${opt}.`,
            COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Desculpe-me, mas não consigo encontrar o cargo ${roleName}. Por favor, tente novamente.`,
            COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Descuple-me, mas ${roleName} já está selecionada.`,
            COMMAND_SETCONF_PREFIX_TOO_LONG: "Desculpe-me, mas você não pode ter espaços no seu prefixo",
            COMMAND_SETCONF_WELCOME_NEED_CHAN: "Desculpe-me, mas seu canal de anúncios ou não existe ou não é mais válido.\nConfigure `announceChan` com um canal válido e tente novamente.`",
            COMMAND_SETCONF_TIMEZONE_NEED_ZONE: "Fuso horário inválido, acesse https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \ne e encontre seu fuso, depois digite o valor referente a coluna TZ",
            COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Desculpe-me, mas não consigo encontrar o canal ${chanName}. Por favor, tente novamente.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: "Desculpe-me, mas não tenho permissão para mandar mensagens nesse canal. Por favor, modifique o canal ou atribua as permissões necessárias.",
            COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Desculpe-me, mas ${value} não é uma linguagem atualmente suportada. \nAs linguagens atualmente suportadas são: \`${langList}\``,
            COMMAND_SETCONF_RESET: "Sua configuração foi reiniciada",
            COMMAND_SETCONF_HELP: {
                description: "Usado para realizar as configurações do bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";setconf <key> <value>",
                        args: {}
                    },
                    {
                        action: "prefix",
                        actionDesc: "Configura o prefixo do bot no seu servidor.",
                        usage: ";setconf prefix <prefix>",
                        args: {}
                    },
                    {
                        action: "adminRole",
                        actionDesc: "O cargo que você deseja que tenha permissão de modificar as configurações do bot ou configurar eventos",
                        usage: ";setconf adminRole <add|remove> <role>",
                        args: {
                            "add":  "Adiciona um cargo na lista",
                            "remove": "Remove um cargo da lista"
                        }
                    },
                    {
                        action: "enableWelcome",
                        actionDesc: "Liga/desliga a mensagem de boas vindas",
                        usage: ";setconf enableWelcome <true|false>",
                        args: {}
                    },
                    {
                        action: "welcomeMessage",
                        actionDesc: "A mensagem de boas vindas que será enviada caso este recurso esteja habilitado (Variáveis especiais abaixo)",
                        usage: ";setconf welcomeMessage <message>",
                        args: {
                            "{{user}}":  "substituido pelo nome do novo usuário",
                            "{{userMention}}": "menção ao novo usuário."
                        }
                    },
                    {
                        action: "enablePart",
                        actionDesc: "Liga/desliga a mensagem de despedida.",
                        usage: ";setconf enablePart <true|false>",
                        args: {}
                    },
                    {
                        action: "partMessage",
                        actionDesc: "A mensagem de despedida que será enviada caso este recurso esteja habilitado (Variáveis especiais abaixo)",
                        usage: ";setconf partMessage <message>",
                        args: {
                            "{{user}}":  "substituído pelo nome do usuário que deixou o servidor.",
                        }
                    },
                    {
                        action: "useEmbeds",
                        actionDesc: "Liga/desliga a utilização de recursos de embeds na saída de alguns comandos.",
                        usage: ";setconf useEmbeds <true|false>",
                        args: {}
                    },
                    {
                        action: "timezone",
                        actionDesc: "Configura o fuso horário para todos os comandos baseados em data\\hora. Acesse o site https://goo.gl/Vqwe49. caso precise de uma lista",
                        usage: ";setconf timezone <timezone>",
                        args: {}
                    },
                    {
                        action: "announceChan",
                        actionDesc: "Configura o nome do canal de anuncios para eventos etc. Certifique-se de que o bot tem permissão para envio de mensagens nesse canal.",
                        usage: ";setconf announceChan <channelName>",
                        args: {}
                    },
                    {
                        action: "useEventPages",
                        actionDesc: "Habilita/Desabilita o uso de paginação na consulta a eventos.",
                        usage: ";setconf useEventPages <true|false>",
                        args: {}
                    },
                    {
                        action: "eventCountdown",
                        actionDesc: "Quanto tempo antes de um evento você gostaria de ser alertado",
                        usage: ";setconf eventCountdown <add|remove> <time>",
                        args: {
                            "add":  "Adciona um período para a lista",
                            "remove": "Remove um período da lista"
                        }
                    },
                    {
                        action: "language",
                        actionDesc: "Configura a lingua que será utilizada pela saída dos comandos do bot.",
                        usage: ";setconf language <lang>",
                        args: {}
                    },
                    {
                        action: "swgohLanguage",
                        actionDesc: "Configura a lingua que será utilizada na saída dos dados do jogo.",
                        usage: ";setconf swgohLanguage <lang>",
                        args: {}
                    },
                    // {
                    //     action: "reset",
                    //     actionDesc: 'Resets the config back to default (ONLY use this if you are sure)',
                    //     usage: ';setconf reset',
                    //     args: {}
                    // }
                ]
            },

            // Shard times command
            COMMAND_SHARDTIMES_MISSING_USER: "Eu preciso que seja mencionado o nome de um usuário, por favor digite \"me\", mencione alguém ou insira o ID Discord.",
            COMMAND_SHARDTIMES_MISSING_ROLE: "Desculpe-me, mas você só pode adicionar você mesmo a não quer que tenha o cargo de administrador.",
            COMMAND_SHARDTIMES_INVALID_USER: "Usuário inválido, por favor digite \"me\", mencione alguém ou insira o ID Discord.",
            COMMAND_SHARDTIMES_MISSING_TIMEZONE: "Você precisa digitar um fuso horário.",
            COMMAND_SHARDTIMES_INVALID_TIMEZONE: "Fuso horário inválido, acesse https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \ne localize seu fuso horário, depois entre com a informação disponível na colna TZ",
            COMMAND_SHARDTIMES_USER_ADDED: "Usuáiro adicionado com sucesso!",
            COMMAND_SHARDTIMES_USER_NOT_ADDED: "Algo deu errado enquanto o usuário era adicionado. Por favor, tente novamente.",
            COMMAND_SHARDTIMES_REM_MISSING_PERMS: "Desculpe-me, mas você só pode remover você mesmo a não ser que tenha o cargo de administrador.",
            COMMAND_SHARDTIMES_REM_SUCCESS: "Usuário removido com sucesso!",
            COMMAND_SHARDTIMES_REM_FAIL: "Algo deu errado enquanto o usuário era removido. Por favor, tente denovo.",
            COMMAND_SHARDTIMES_REM_MISSING: "Desculpe-me, mas não encontrei esse usuário.",
            COMMAND_SHARDTIMES_SHARD_HEADER: "Recompensa do Shard em:",
            COMMAND_SHARDTIMES_HELP: {
                description: "Lista o tempo até a recompensa do shard da arena de cada membro registrado.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: "Adiciona um jogador ao rastreador de Shard",
                        usage: ";shardtimes add <user> <timezone> [flag/emoji]",
                        args: {
                            "user": "A pessoa que você está adicionando. (me | userID | mention)",
                            "timezone": "O fuso horário em que este jogador está baseado",
                            "flag/emoji": "Um emoji (opcional) para ser exibido ao lado do nome do jogador"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: "Remove o jogador do rastreador de shard",
                        usage: ";shardtimes remove <user>",
                        args: {
                            "user": "A pessoa que está sendo removida. (me | userID | mention)"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Exibe os seus horários de recompensa e de seus companheiros de shard",
                        usage: ";shardtimes view",
                        args: {}
                    }
                ]
            },

            // Ships Command
            COMMAND_SHIPS_NEED_CHARACTER: (prefix) => `Precisa de um personagem ou nave. Uso correto é \`${prefix}ship <ship|pilot>\``,
            COMMAND_SHIPS_INVALID_CHARACTER: (prefix) => `Personagem ou nave inválido. Uso correto é \`${prefix}ship <ship|pilot>\``,
            COMMAND_SHIPS_TOO_MANY: "Encontrei mais de um resultado para a busca. Por favor, tente ser mais específico.",
            COMMAND_SHIPS_CREW: "Tripulação",
            COMMAND_SHIPS_FACTIONS: "Facção",
            COMMAND_SHIPS_ABILITIES: (abilities) => `**Tipo de Habilidade:** ${abilities.type}   **Recarga de Abilidade:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
            COMMAND_SHIPS_CODE_ABILITES_HEADER: " * Habilidades *\n",
            COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nTipo de Habilidade: ${abilities.type}   Recarga de Habilidade: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
            COMMAND_SHIPS_HELP: {
                description: "Exibe informações da nave selecionada.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "ship <ship|pilot>",
                        args: {
                            "ship|pilot": "O nome da nave ou do piloto para o qual se deseja obter informação."
                        }
                    }
                ]
            },

            // Showconf Command
            COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `Segue a configuração do servidor ${serverName}: \`\`\`${configKeys}\`\`\``,
            COMMAND_SHOWCONF_HELP: {
                description: "Exibe a informação corrente do servidor.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";showconf",
                        args: {}
                    }
                ]
            },

            // Stats Command
            COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID) => `= ESTATÍSTICAS (${shardID}) =\n
• Memória      :: ${memUsage} MB
• Uso de CPU   :: ${cpuLoad}%
• Tempo Ligado :: ${uptime}
• Usuários     :: ${users}
• Servidores   :: ${servers}
• Canais       :: ${channels}
• Fonte        :: https://github.com/jmiln/SWGoHBot`,
            COMMAND_STATS_HELP: {
                description: "Exibe o status do bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";stats",
                        args: {}
                    }
                ]
            },

            // Test command (in .gitignore)
            COMMAND_TEST_HELP: {
                description: "Um comando para testar coisas.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";test",
                        args: {}
                    }
                ]
            },

            // Time Command
            COMMAND_TIME_CURRENT: (time, zone) => `A hora atual é: ${time} no fuso horário ${zone}`,
            COMMAND_TIME_INVALID_ZONE: (time, zone) => `Fuso horário inválido, essa é a hora atual da sua guilda ${time} no fuso horário ${zone}`,
            COMMAND_TIME_NO_ZONE: (time) => `O horário atual é: ${time} UTC`,
            COMMAND_TIME_WITH_ZONE: (time, zone) => `O horário atual é: ${time} no fuso horário ${zone}`,
            COMMAND_TIME_HELP: {
                description: "Usado para verificar o horário no fuso horário da sua guilda",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";time [timezone]",
                        args: {
                            "timezone": "Opcional, se você quer consultar as horas com outro fuso horário"
                        }
                    }
                ]
            },

            // Updatechar Command
            COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `Desculpe-me, mas ${arg} não é um argumento válido. Tente um desses: ${usableArgs}`,
            COMMAND_UPDATECHAR_NEED_CHAR: "Você precisa especificar um personagem para atualizar.",
            COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Desculpe-me, mas sua busca por '${charName}' não encontrou nenhum resultado. Por favor, tente novamente.`,
            COMMAND_UPDATECHAR_HELP: {
                description: "Atualiza as informações de um dado personagem.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";updatechar [gear|info|mods] [charater]",
                        args: {
                            "gear": "Atualiza os equipamentos do personagem.",
                            "info": "Autaliza as informações do personagem (Link da imagem, habilidades etc.)",
                            "mods": "Atualiza os modificadores a partir do crouchingrancor.com"
                        }
                    }
                ]
            },

            // UpdateClient Command
            COMMAND_UPDATECLIENT_HELP: {
                description: "Atualiza o cliente da API SWGoHAPI.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";updateclient",
                        args: {}
                    }
                ]
            },

            // Zetas Command
            COMMAND_ZETA_NO_USER: "Desculpe-me, você não tem o personagem listado em nenhum lugar.",
            COMMAND_ZETA_NO_ZETAS: "Você não parece ter nenhuma habilidade com zeta.",
            COMMAND_ZETA_OUT_DESC: `\`${"-".repeat(30)}\`\n\`[L]\` Líder | \`[S]\` Especial | \`[U]\` Único\n\`${"-".repeat(30)}\``,
            COMMAND_ZETAS_HELP: {
                description: "Exibe as habilidades nas quais você equipou um zeta.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";zeta [user]",
                        args: {
                            "user": "O jogador que você está consultando. (me | userID | mention)"
                        }
                    }
                ]
            }
        };
    }
};
