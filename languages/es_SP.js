const Language = require('../base/Language');
const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: 'Do',
        LONG: 'Domingo'
    },
    MONDAY: {
        SHORT: 'Lu',
        LONG: 'Lunes'
    },
    TUESDAY: {
        SHORT: 'Ma',
        LONG: 'Martes'
    },
    WEDNESDAY: {
        SHORT: 'Mi',
        LONG: 'Miércoles'
    },
    THURSDAY: {
        SHORT: 'Ju',
        LONG: 'Jueves'
    },
    FRIDAY: {
        SHORT: 'Vi',
        LONG: 'Viernes'
    },
    SATURDAY: {
        SHORT: 'Sa',
        LONG: 'Sábado'
    }
};
const TIMES = {
    DAY: {
        PLURAL: 'Días',
        SING: 'Día',
        SHORT_PLURAL: 'DS',
        SHORT_SING: 'D'
    },
    HOUR: {
        PLURAL: 'Horas',
        SING: 'Hora',
        SHORT_PLURAL: 'Hrs',
        SHORT_SING: 'Hr'
    },
    MINUTE: {
        PLURAL: 'Minutos',
        SING: 'minuto',
        SHORT_PLURAL: 'Mins',
        SHORT_SING: 'Min'
    },
    SECOND: {
        PLURAL: 'Segundos',
        SING: 'Segundo',
        SHORT_PLURAL: 'Segs',
        SHORT_SING: 'Seg'
    }
};

function getDay(day, type) {
    return DAYSOFWEEK[`${day}`][`${type}`];
}

function getTime(unit, type) {
    return TIMES[`${unit}`][`${type}`];
}

module.exports = class extends Language {
    constructor(...args) {
        super(...args);

        this.getDay = getDay;
        this.getTime = getTime;
        this.language = {
            // Default in case it can't find one.
            BASE_DEFAULT_MISSING: 'Se está intentando utilizar una cadena inexistente. Si ves este mensaje, por favor reportarlo así podrá ser reparado.',

            // Base swgohBot.js file
            BASE_LAST_EVENT_NOTIFICATION: `\n\nEsta es la última instancia de este evento. Para continuar recibiendo este aviso, crea un nuevo evento.`,
            BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nEmpieza en ${timeToGo}`,

            // Base swgohAPI
            BASE_SWGOH_NO_ALLY: `Lo siento, pero este usuario no está registrado. Por favor regístrate con  \`;register add <user> <códigoaliado>\``,
            BASE_SWGOH_NOT_REG: (user) => `Lo siento, pero este usuario no está registrado. Por favor regístrate con \`;register add @${user} < códigoaliado>\``,
            BASE_SWGOH_NO_USER: (prefix) => `Lo siento, pero no tengo este usuario listado en ningún sitio. Por favor comprueba que te has registrado con \`${prefix}register add <user> <códigoaliado>\``,
            BASE_SWGOH_NO_GUILD_FOR_USER: (prefix=';') => `No he podido encontrar un gremio para este usuario. Por favor comprueba que esta registrado con \`${prefix}register add <usario> <códigoaliado>\``,
            BASE_SWGOH_NO_GUILD: 'No he podido encontrar ningún usuario para este gremio. \nPor favor comprueba que hayas escrito el nombre correctamente(Mayúsculas incluidas).',
            BASE_SWGOH_MISSING_CHAR: 'Necesitas introducir un personaje para comprobar',
            BASE_SWGOH_NO_CHAR_FOUND: (character) => `No encuentro ningún resultado para ${character}`,
            BASE_SWGOH_CHAR_LIST: (chars) => `Tu búsqueda ha obtenido demasiados resultados, por favor se mas especifico. \nAquí tienes una lista de las coincidencias más cercanas.\n\`\`\`${chars}\`\`\``,
            BASE_SWGOH_NO_ACCT: `Algo ha salido mal, por favor comprueba que tu cuenta se haya sincronizado correctamente.`,
            BASE_SWGOH_LAST_UPDATED: (date) => `Última actualización hace ${date} min`,
            BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `Por favor espera mientras obtengo tu ${dType ? dType : 'data'}`,
            BASE_SWGOH_NAMECHAR_HEADER: (name, char) => `${name}'s ${char}`,

            // Generic (Not tied to a command)
            COMMAND_EXTENDED_HELP: (command) => `**Ayuda extendida para ${command.help.name}** \n**Uso**: ${command.help.usage} \n${command.help.extended}`,
            COMMAND_INVALID_BOOL: `Valor invalido, prueba con true o false`,
            COMMAND_MISSING_PERMS: `Lo siento, pero no tienes los suficientes permisos para hacer esto.`,
            BASE_COMMAND_UNAVAILABLE: "Este comando no está disponible vía mensaje privado. Por favor, utiliza este comando en un gremio.",
            BASE_COMMAND_HELP_HEADER: (name) => `Ayuda para ${name}`,
            BASE_COMMAND_HELP_HEADER_CONT: (name) => `Ayuda continuada para ${name}`,
            BASE_CONT_STRING: '(cont)',
            BASE_COMMAND_HELP_HELP: (name) => {
                return {
                    action: "Ayuda",
                    actionDesc: "Muestra este mensaje",
                    usage: `;${name} help`,
                    args: {}
                };
            },
            BASE_MOD_TYPES: {
                SQUARE: 'Cuadrado',
                ARROW:   'Flecha',
                DIAMOND: 'Diamante',
                TRIANGLE: 'Triángulo',
                CIRCLE: 'Círculo',
                CROSS:   'Cruz',
                ACCURACY:   'Potencia',
                CRITCHANCE: 'Probabilidad de crítico',
                CRITDAMAGE: 'Daño crítico',
                DEFENSE:    'Defensa',
                HEALTH:     'Salud',
                OFFENSE:    'Ataque',
                POTENCY:    'Potencia',
                SPEED:      'Velocidad',
                TENACITY:   'Tenacidad'
            },

            // Abilities Command
            COMMAND_ABILITIES_NEED_CHARACTER: (prefix) => `Se necesita un personaje. Su uso es \`${prefix}abilities <NombrePersonaje>\``,
            COMMAND_ABILITIES_INVALID_CHARACTER: (prefix) => `Personaje inválido. Su uso es \`${prefix}abilities <NombrePersonaje>\``,
            COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Tiempo de Refresco:** ${aCooldown}\n`,
            COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Tipo de habilidad:** ${aType}     **Material necesario para la habilidad máxima:**  ${mat}\n${cdString}${aDesc}`,
            COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* Tipo de habilidad: ${type}\n* Material necesario para la habilidad máxima: ${tier}\n* Descripción: ${aDesc}\n\n`,
            COMMAND_ABILITIES_HELP: {
                description: "Muestra las habilidades del personaje especificado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';abilities <Nombrepersonaje>',
                        args: {}
                    }
                ]
            },

            // Activities Command
            COMMAND_ACTIVITIES_SUNDAY: `== Antes del Refresco == \nCompletar las batallas de Arena \n Ahorrar Energía de la Cantina  \nAhorrar Energía Normal\n\n== Después del Refresco == \nGastar Energía de la Cantina \nAhorrar Energía Normal`,
            COMMAND_ACTIVITIES_MONDAY: `== Antes del Refresco == \nGastar Energía de la Cantina \nAhorrar Energía Normal \n\n== Después del Refresco == \nGastar Energía Normal en Batallas del Lado Luminoso`,
            COMMAND_ACTIVITIES_TUESDAY: `== Antes del Refresco == \nGastar energía normal en Batallas del Lado Luminoso \n Ahorrar Todo Tipo de Energía\n\n== Después del Refresco == \n Gastar Todo Tipo de Energía \n Ahorrar Energía Normal`,
            COMMAND_ACTIVITIES_WEDNESDAY: `== Antes del Refresco == \nGastar Todo Tipo de Energia \nAhorrar Energía Normal\n\n== Después del Refresco == \nGastar Energía Normal en Batallas Difíciles`,
            COMMAND_ACTIVITIES_THURSDAY: `== Antes del Refresco == \nGastar Energía Normal en Batallas Difíciles \nAhorrar Desafíos\n\n== Después del Refresco == \nCompletar los Desafíos \nAhorrar Energía Normal`,
            COMMAND_ACTIVITIES_FRIDAY: `== Antes del Refresco == \nCompletar los Desafíos \nAhorrar Energía Normal\n\n== Después del Refresco == \nGastar Energía Normal en Batallas del Lado Oscuro`,
            COMMAND_ACTIVITIES_SATURDAY: `== Antes del Refresco == \nGastar Energía Normal en Batallas del Lado Oscuro \nAhorrar Batallas de Arena \nAhorrar Energía de Cantina\n\n== Después del Reseteo == \nCompletar batallas de Arena \nAhorrar Energía de Cantina`,
            COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Día inválido, su uso es \`${prefix}${usage}\``,
            COMMAND_ACTIVITIES_HELP: {
                description: "Muestra las actividades diarias del gremio.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';activities [DíaDeLaSemana]',
                        args: {}
                    }
                ]
            },

            // Arenarank Command
            COMMAND_ARENARANK_INVALID_NUMBER: `Necesitas introducir un número del ranking valido`,
            COMMAND_ARENARANK_BEST_RANK: `Ya has llegado lo más lejos que puedes posible, felicidades!`,
            COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `Del Ranking ${currentRank}, in ${battleCount} battle${plural} ${est}\nEl mejor que puedes obtener es ${rankList}`,
            COMMAND_ARENARANK_HELP: {
                description: "Muestra (aproximadamente) el mejor rango que puedes obtener si ganas cada batalla de arena.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';arenarank <Rankingactual> [Contador Batallas]',
                        args: {}
                    }
                ]
            },

            // Challenges Command
            COMMAND_CHALLENGES_TRAINING: "Droides de entrenamiento",
            COMMAND_CHALLENGES_ABILITY : "Materiales de habilidad",
            COMMAND_CHALLENGES_BOUNTY  : "Cazarecompensas",
            COMMAND_CHALLENGES_AGILITY : "Equipo de Agi",
            COMMAND_CHALLENGES_STRENGTH: "Equipo de Fue",
            COMMAND_CHALLENGES_TACTICS : "Equipo de Tac",
            COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "Droides de mejora de nave",
            COMMAND_CHALLENGES_SHIP_BUILDING   : "Materiales de construcción de nave",
            COMMAND_CHALLENGES_SHIP_ABILITY    : "Materiales de habilidad de nave",
            COMMAND_CHALLENGES_MISSING_DAY: 'Necesitas especificar un día',
            COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `Fecha invalida, su uso \`${prefix}${usage}\``,
            COMMAND_CHALLENGES_HELP: {
                description: "Muestra las actividades diarias del gremio.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';challenges <DíaDeLaSemana>',
                        args: {}
                    }
                ]
            },

            // Changelog Command (Help)
            COMMAND_CHANGELOG_HELP: {
                description: "Añade un cambio a la base de datos y lo envía al canal de registro de cambios.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'changelog <mensaje>',
                        args: {
                            "mensaje": "Utiliza [Updated], [Fixed], [Removed], y [Added] para organizar los cambios."
                        }
                    }
                ]
            },

            // Character gear Command
            COMMAND_CHARGEAR_NEED_CHARACTER: (prefix) => `Se necesita un personaje. Su uso es \`${prefix}charactergear <personaje> [NivelEstrella]\``,
            COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix) => `Personaje invalido. Su uso es \`${prefix}charactergear <personaje> [NivelEstrella]\``,
            COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### Gear necesario ### \n${gearString}`,
            COMMAND_CHARGEAR_GEAR_NA: 'Este gear aún no se ha establecido',
            COMMAND_CHARACTERGEAR_HELP: {
                description: "Muestra el gear (equipo) necesario para el personaje seleccionado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'charactergear <personaje> [EquipoLvl]',
                        args: {}
                    }
                ]
            },

            // Command Report Command
            COMMAND_COMMANDREPORT_HELP: ({
                description: "Muestra una lista de todos los comandos que has usado en los últimos 10 días.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';commandreport',
                        args: {}
                    }
                ]
            }),

            // Current Events Command
            COMMAND_CURRENTEVENTS_HEADER: "Eventos SWGOH Planificados",
            COMMAND_CURRENTEVENTS_DESC: (num) => `Siguientes ${num} eventos.\nNota: *Las Fechas están sujetas a cambios.*`,
            COMMAND_CURRENTEVENTS_HELP: {
                description: "Muestra cualquier evento próximo.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';currentevents [num]',
                        args: {
                            "num": "El número máximo de eventos que quieres que te muestre"
                        }
                    }
                ]
            },

            // Event Command (Create)
            COMMAND_EVENT_INVALID_ACTION: (actions) => `Las acciones validas són \`${actions}\`.`,
            COMMAND_EVENT_INVALID_PERMS: `Lo siento, pero tal vez no eres administrador, o el líder de tu servidor no ha establecido bien la configuración. \nNo puedes añadir o eliminar un evento a no ser que tengas configurado el rol de administrador.`,
            COMMAND_EVENT_ONE_REPEAT: 'Lo siento, pero no puedes usar ambos `repeat` and `repeatDay` en un mismo evento. Por favor selecciona una u otra opción',
            COMMAND_EVENT_INVALID_REPEAT: `La repetición está en un formato erróneo. Ejemplo: \`5d3h8m\` para 5 días, 3 horas y 8 minutos`,
            COMMAND_EVENT_USE_COMMAS: `Por favor, usa una coma separada de los números para el repeatDay. Ejemplo: \`1,2,1,3,4\``,
            COMMAND_EVENT_INVALID_CHAN: `Este canal es invalido, por favor prueba de nuevo`,
            COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `No tengo permisos para enviar mensajes en ${channel}, por favor selecciona uno donde pueda`,
            COMMAND_EVENT_NEED_CHAN: `ERROR: Necesito configurar un canal donde poder enviar-lo. Configura \`announceChan\` para ser capaz de crear eventos.`,
            COMMAND_EVENT_NEED_NAME: `Debes de dar un nombre a tu evento.`,
            COMMAND_EVENT_EVENT_EXISTS: `El nombre de este evento ya existe. No se puede añadir de nuevo.`,
            COMMAND_EVENT_NEED_DATE: `Debes dar una fecha para tu evento. El formato Aceptado es \`DD/MM/YYYY\`.`,
            COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate} no es una fecha valida. El formato Aceptado es \`DD/MM/YYYY\`.`,
            COMMAND_EVENT_NEED_TIME: `Debes dar un tiempo a tu evento.`,
            COMMAND_EVEMT_INVALID_TIME: `Debes dar un tiempo correcto para tu evento. El formato Aceptado es \`HH:MM\`, using a 24 hour clock. So no AM or PM`,
            COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `No puedes establecer un evento en el pasado. ${eventDATE} es anterior ${nowDATE}`,
            COMMAND_EVENT_CREATED: (eventName, eventDate) => `Evento \`${eventName}\` creado para ${eventDate}`,
            COMMAND_EVENT_NO_CREATE: `No he podido establecer este evento, por favor prueba de nuevo.`,
            COMMAND_EVENT_TOO_BIG:(charCount) => `Lo siento, pero el nombre o mensaje de tu evento es demasiado largo. Por favor recórtalo al menos hasta ${charCount} caracteres.`,

            // Event Command (View)
            COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \nTiempo del Evento: ${eventDate}\n`,
            COMMAND_EVENT_TIME_LEFT: (timeLeft) => `Tiempo Restante: ${timeLeft}\n`,
            COMMAND_EVENT_CHAN: (eventChan) => `Enviándolo al canal: ${eventChan}\n`,
            COMMAND_EVENT_SCHEDULE: (repeatDays) => `Repetir horario: ${repeatDays}\n`,
            COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `Repitiendo cada ${eventDays} días, ${eventHours} horas y ${eventMins} minutos\n`,
            COMMAND_EVENT_MESSAGE: (eventMsg) => `Mensaje Evento: \n\`\`\`md\n${eventMsg}\`\`\``,
            COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `Lo siento, pero no he podido encontrar el evento \`${eventName}\``,
            COMMAND_EVENT_NO_EVENT: `Actualmente no tienes ningún evento programado.`,
            COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `Aquí tienes el Evento Programado de tu servidor \n(${eventCount} eventos totales${eventCount > 1 ? 's' : ''}) Mostrando página ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`,
            COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `Aquí esta el evento programado de tu servidor \n(${eventCount} eventos totales${eventCount > 1 ? 's' : ''}): \n${eventKeys}`,

            // Event Command (Delete)
            COMMAND_EVENT_DELETE_NEED_NAME: `Debes de dar un nombre al evento a eliminar.`,
            COMMAND_EVENT_DOES_NOT_EXIST: `Este evento no existe.`,
            COMMAND_EVENT_DELETED: (eventName) => `Evento eliminado: ${eventName}`,

            // Event Command (Trigger)
            COMMAND_EVENT_TRIGGER_NEED_NAME: ` Debes  indicar el nombre del evento para iniciarlo.`,

            // Event Command (Help)
            COMMAND_EVENT_HELP: {
                description: "Se usa para crear, comprobar o eliminar un evento.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: 'Crear una nueva lista del evento',
                        usage: ';event create <eventName> <eventDay> <eventTime> [eventMessage]',
                        args: {
                            "--repeat <repeatTime>": "Te permite establecer una duración con el formato 00d00h00m. Se repetirá después de que el tiempo haya pasado.",
                            "--repeatDay <schedule>": "Te permite establecer una repetición en los días con el formato 0,0,0,0,0.",
                            "--channel <channelName>": "Te permite especificar un canal para el evento donde anunciarse.",
                            "--countdown": "Añade un contador cuando tu evento se va a iniciar."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'Ver tu lista actual de eventos.',
                        usage: ';event view [eventName]',
                        args: {
                            "--min": "Te permite ver los eventos sin el mensaje de un evento.",
                            "--page <page#>": "Te permite seleccionar una página donde ver los eventos"
                        }
                    },
                    {
                        action: "Delete",
                        actionDesc: 'Eliminar un evento.',
                        usage: ';Eliminación de un evento <eventName>',
                        args: {}
                    },
                    {
                        action: "Trigger",
                        actionDesc: 'Inicia un evento en el canal especificado y deja el otro evento solo.',
                        usage: ';event trigger <eventName>',
                        args: {}
                    }
                ]
            },

            // Faction Command
            COMMAND_FACTION_INVALID_CHAR: (prefix) => `Facción invalida, su uso es \`${prefix}faction <faction>\``,
            COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# caracteres en la ${searchName} facción# \n${charString}`,
            COMMAND_FACTION_HELP: {
                description: "Muestra una lista de personajes de una facción especificada.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'faction <faction>',
                        args: {
                            "faction": "La facción  la cual quieres ver su lista. \nTen en mente, esto es como se muestra en el juego, así que es rebel no rebeldes"
                        }
                    }
                ]
            },

            // Guilds Command
            COMMAND_GUILDS_MORE_INFO: 'Para más información de un Gremio específico:',
            COMMAND_GUILDS_HELP: {
                description: "Muestra los Gremios más TOPS y todas las personas que están registradas en el tuyo.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';guild [user]',
                        args: {
                            "user": "La manera de identificar un gremio. (mention | allyCode | guildName)"
                        }
                    }
                ]
            },

            // GuildSearch Command
            COMMAND_GUILDSEARCH_BAD_STAR: 'Solo puedes seleccionar una estrella del nivel 1 al 7',
            COMMAND_GUILDSEARCH_BAD_SORT: (sortType, filters) => `Lo Siento, pero \`${sortType}\` no es un metodo de clasificación admitido. Solo \`${filters.join(', ')}\` esta permitido.`,
            COMMAND_GUILDSEARCH_MISSING_CHAR: 'Necesitas introducir un personaje para la busqueda',
            COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `No he encontrado ningún resultado de ${character}`,
            COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `La búsqueda se ha encontrado con demasiados resultados, por favor se más especifico. \nAquí tienes una lista de las coincidencias más cercanas.\n\`\`\`${chars}\`\`\``,
            COMMAND_GUILDSEARCH_FIELD_HEADER: (tier, num, setNum='') => `${tier} Estrella (${num}) ${setNum.length > 0 ? setNum : ''}`,
            COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `Parece que nadie de tu gremio tiene un personaje con ${starLvl} estrellas.`,
            COMMAND_GUILDSEARCH_NO_CHAR: `Nadie de tu gremio parece tener este personaje.`,
            COMMAND_GUILDSEARCH_HELP: {
                description: "Muestra el nivel de estrellas del personaje seleccionado, de TODAS las personas del gremio.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';guildsearch [user] <character> [-ships] [starLvl]',
                        args: {
                            "user": "La persona la cual estas añadiendo. (me | userID | mention)",
                            "character": "El personaje el cual quieres realizar la busqueda.",
                            "-ships": "Busqueda de naves, puedes usar `-s, -ship, or -ships`",
                            "starLvl": "Selecciona el nivel de estrella que quieres ver."
                        }
                    }
                ]
            },

            // Heists Command
            COMMAND_HEISTS_HEADER: "SWGOH Robo de Créditos Programado",
            COMMAND_HEISTS_CREDIT: (date) => `**Créditos** : ${date}\n`,
            COMMAND_HEISTS_DROID: (date) => `**Droides**  : ${date}\n`,
            COMMAND_HEISTS_NOT_SCHEDULED: "`No Programado`",
            COMMAND_HEISTS_HELP: {
                description: "Muestra los próximos Desafíos de Robos.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';heists',
                        args: {}
                    }
                ]
            },


            // Help Command
            COMMAND_HELP_HEADER: (prefix) => `= ComandoDeseado =\n\n[Usa ${prefix}help <ComandoDeseado> para más detalles]\n`,
            COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUso:: ${prefix}${command.help.usage}`,
            COMMAND_HELP_HELP: {
                description: "Muestra la información sobre los comandos disponibles.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';help [Comando]',
                        args: {
                            "Comando": "El comando el cual quieres saber información."
                        }
                    }
                ]
            },

            // Info Command
            COMMAND_INFO_OUTPUT: (guilds) => ({
                "header": 'INFORMATION',
                "desc": ` \nActualmente en proceso en **${guilds}** servidores \n`,
                "links": {
                    "Invite me": "Invita al bot http://swgohbot.com/invite",
                    "Support Server": "Si tienes alguna pregunta, quieres ayudar, o simplemente unirte, el soporte del bot es https://discord.gg/FfwGvhr",
                    "Support the Bot": "El código del bot está en github https://github.com/jmiln/SWGoHBot y está abierto a contribuciones. \n\nI también tiene un patrocinador https://www.patreon.com/swgohbot por si estás interesado."
                }
            }),
            COMMAND_INFO_HELP: {
                description: "Muestra los links útiles pertinentes del bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'info',
                        args: {}
                    }
                ]
            },

            COMMAND_MODS_CRIT_CHANCE_SET: "Prob. Crítico x2",
            COMMAND_MODS_CRIT_DAMAGE_SET: "Daño. Crítico x4",
            COMMAND_MODS_SPEED_SET: "Velocidad x4",
            COMMAND_MODS_TENACITY_SET: "Tenacidad x2",
            COMMAND_MODS_OFFENSE_SET: "Ataque x4",
            COMMAND_MODS_POTENCY_SET: "Potencia x2",
            COMMAND_MODS_HEALTH_SET: "Salud x2",
            COMMAND_MODS_DEFENSE_SET: "Defensa x2",
            COMMAND_MODS_EMPTY_SET: " ",

            COMMAND_MODS_ACCURACY_STAT: "Evasión. Crítico",
            COMMAND_MODS_CRIT_CHANCE_STAT: "Prob. Crítico",
            COMMAND_MODS_CRIT_DAMAGE_STAT: "Daño. Crítico",
            COMMAND_MODS_DEFENSE_STAT: "Defensa",
            COMMAND_MODS_HEALTH_STAT: "Salud",
            COMMAND_MODS_OFFENSE_STAT: "Ataque",
            COMMAND_MODS_PROTECTION_STAT: "Protección",
            COMMAND_MODS_POTENCY_STAT: "Potencia",
            COMMAND_MODS_SPEED_STAT: "Velocidad",
            COMMAND_MODS_TENACITY_STAT: "Tenacidad",
            COMMAND_MODS_UNKNOWN: "Desconocido",

            // Mods Command
            COMMAND_MODS_NEED_CHARACTER: (prefix) => `Se necesita un personaje. Su uso es \`${prefix}mods <characterName>\``,
            COMMAND_MODS_INVALID_CHARACTER: (prefix) => `Personaje inválido. Su uso es \`${prefix}mods <characterName>\``,
            COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) => `\`Cuadrado:   ${square}\`\n\`Flecha:    ${arrow}\`\n\`Diamante:  ${diamond}\`\n`,
            COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Triangulo: ${triangle}\`\n\`Circulo:   ${circle}\`\n\`Cruz:    ${cross}\`\n`,
            COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### Sets ###**\n${modSetString}\n**### Primarios ###**\n${modPrimaryString}`,
            COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) => `* Cuadrado:   ${square}  \n* Flecha:    ${arrow} \n* Diamante:  ${diamond}\n`,
            COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Triangulo: ${triangle}\n* Circlulo:   ${circle}\n* Cruz:    ${cross}`,
            COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### Sets ### \n${modSetString}\n### Primarios ###\n${modPrimaryString}`,
            COMMAND_NO_MODSETS: "No hay mods establecidos en este personaje",
            COMMAND_MODS_HELP: {
                description: "Muestra los mods sugeridos para el personaje especificado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'mods <character>',
                        args: {
                            "character": "El personaje el cual quieres mostrar sus mods"
                        }
                    }
                ]
            },

            // Modsets command
            COMMAND_MODSETS_OUTPUT: `* Prob. Crítico:  2\n* Daño. Crítico:  4\n* Defensa:  2\n* Salud:   2\n* Ataque:  4\n* Potencia:  2\n* Velocidad:    4\n* Tenacidad: 2`,
            COMMAND_MODSETS_HELP: {
                description: "Muestra cuantos mods de cada tipo necesitas para un Set.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'modsets',
                        args: {}
                    }
                ]
            },
            // MyArena Command
            COMMAND_MYARENA_NO_USER: (user) => `Lo siento, pero no puedo encontrar ninguna información de la Arena para ${user}. Por favor asegúrate que esa cuenta esté sincronizada.`,
            COMMAND_MYARENA_NO_CHAR: 'Algo ha salido mal, no puedo obtener tus personajes.',
            COMMAND_MYARENA_ARENA: (rank) => `Arena de Escuadrones (Puesto: ${rank})`,
            COMMAND_MYARENA_FLEET: (rank) => `Arena de Flotas (Puesto: ${rank})`,
            COMMAND_MYARENA_EMBED_HEADER: (playerName) => `${playerName}'s Arena`,
            COMMAND_MYARENA_EMBED_FOOTER: (date) => `información de la Arena actualizada: ${date}`,
            COMMAND_MYARENA_HELP: {
                description: " Muestra el puesto actual del jugador en Arena y sus escuadrones.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';myarena [user]',
                        args: {
                            "user": "El usuario que se desea ver. (me | userID | mention)"
                        }
                    }
                ]
            },

            // MyCharacter Command
            COMMAND_MYCHARACTER_HELP: ({
                description: "Muestra las estadísticas del personaje seleccionado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';mycharacter [usuario] <personaje>',
                        args: {
                            "usuario": "El usuario que se desea ver. (me | userID | mention)",
                            "personaje": "El personaje que se desea buscar."
                        }
                    }
                ]
            }),

            // MyMods Command
            COMMAND_MYMODS_NO_MODS: (charName) => `Lo siento, pero no he podido encontrar ningún mod para ${charName}`,
            COMMAND_MYMODS_MISSING_MODS: `Lo siento, pero no he podido encontrar tus mods en este momento. Por favor espera un poco e intenta de nuevo.`,
            COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `Mods last updated: ${lastUpdated} ago`,
            COMMAND_MYMODS_HELP: ({
                description: "Muestra los mods que tienes equipados el personaje seleccionado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';mymods [usuario] <personaje>',
                        args: {
                            "usuario": "El usuario que se desea cer. (me | userID | mention)",
                            "personaje": "El personaje que se desea buscar."
                        }
                    }
                ]
            }),

            // MyProfile Command
            COMMAND_MYPROFILE_NO_USER: (user) => `Lo siento, pero no puedo encontrar ninguna información de la Arena para ${user}. Por favor asegúrese que esa cuenta esté sincronizada.`,
            COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `Perfil de ${playerName} (${allyCode})`,
            COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `información de la Arena actualizada: ${date}`,
            COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank) => `**Gremio:** ${guildName}\n**Nivel:** ${level}\n**Puesto en Arena:** ${charRank}\n**Posición de Naves:** ${shipRank}`,
            COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount) => ({
                header: `Personajes (${charList.length})`,
                stats: [
                    `PG de PJ.  :: ${gpChar}`,
                    `7 Estrellas   :: ${charList.filter(c => c.rarity === 7).length}`,
                    `nvl 85   :: ${charList.filter(c => c.level === 85).length}`,
                    `Equipo 12  :: ${charList.filter(c => c.gear === 12).length}`,
                    `Equipo 11  :: ${charList.filter(c => c.gear === 11).length}`,
                    `Equipo    :: ${zetaCount}`
                ].join('\n')
            }),
            COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
                header: `Naves (${shipList.length})`,
                stats: [
                    `PG de Naves :: ${gpShip}`,
                    `7 Estrellas  :: ${shipList.filter(s => s.rarity === 7).length}`,
                    `nvl 85  :: ${shipList.filter(s => s.level === 85).length}`
                ].join('\n')
            }),
            COMMAND_MYPROFILE_HELP: {
                description: "Muestra las estadísticas generales del usuario.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';myprofile [usuario]',
                        args: {
                            "usuario": "El usuario que se desea ver. (me | userID | mention)"
                        }
                    }
                ]
            },

            // Nickname Command
            COMMAND_NICKNAME_SUCCESS: `He cambiado mi nombre.`,
            COMMAND_NICKNAME_FAILURE: `Lo siento, pero no tengo permiso para cambiar eso.`,
            COMMAND_NICKNAME_TOO_LONG: 'Lo siento, pero el nombre solo puede tener hasta 32 caracteres de longitud.',
            COMMAND_NICKNAME_HELP: {
                description: "Cambia el nombre del bot en el servidor.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';nickname <nombre>',
                        args: {
                            "nombre": "El nombre que deseas asignarle al bot. Déjalo en blanco para restablecer el nombre por defecto."
                        }
                    }
                ]
            },

            // Polls Command
            COMMAND_POLL_NO_ARG: 'Necesitas proporcionar al menos una opción para votar o bien una acción (create/view/etc).',
            COMMAND_POLL_ALREADY_RUNNING: "Lo siento, pero solo puedes realizar una encuesta a la vez. Por favor primero termina la encuesta actual.",
            COMMAND_POLL_MISSING_QUESTION: "Necesitas especificar algo para votar.",
            COMMAND_POLL_TOO_FEW_OPT: "Necesitas tener al menos 2 opciones para votar.",
            COMMAND_POLL_TOO_MANY_OPT: "Sólo puedes tener hasta 10 opciones para votar.",
            COMMAND_POLL_CREATED: (name, prefix, poll) => `**${name}** ha iniciado una nueva encuesta:\nVota con \`${prefix}poll <opción>\`\n\n${poll}`,
            COMMAND_POLL_NO_POLL: "No hay ninguna encuesta en progreso.",
            COMMAND_POLL_FINAL: (poll) => `Resultados funales para ${poll}`,
            COMMAND_POLL_FINAL_ERROR: (question) => `No he podido eliminar la pregunta **${question}**, por favor intentalo de nuevo.`,
            COMMAND_POLL_INVALID_OPTION: "No es una opción válida.",
            COMMAND_POLL_SAME_OPT: (opt) => `Ya has elegido la opción **${opt}**`,
            COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `Has cambiado tu voto de **${oldOpt}** a **${newOpt}**`,
            COMMAND_POLL_REGISTERED: (opt) => `Voto por **${opt}** registrado`,
            COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice}: **${optCount} vote${optCount === 1 ? '' : 's'}**\n`,
            COMMAND_POLL_HELP: {
                description: "Te permite empezar una encuesta con múltiples opciones.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: 'Crea una nueva encuesta',
                        usage: ';poll create <pregunta> | <opt1> | <opt2> | [...] | [opt10]',
                        args: {
                            "pregunta": "La pregunta de la cual esperas una respuesta.",
                            "opt": "Las opciones las cuales se puede escoger."
                        }
                    },
                    {
                        action: "Vote",
                        actionDesc: 'Vota la opción de tu elección.',
                        usage: ';poll <opción>',
                        args: {
                            "opción": "La opción que eliges."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'Ver cuál el total de votos actual.',
                        usage: ';poll view',
                        args: {}
                    },
                    {
                        action: "Close",
                        actionDesc: 'Termina la encuesta y muestra el conteo final.',
                        usage: ';poll close',
                        args: {}
                    }
                ]
            },

            // Raidteams Command
            COMMAND_RAIDTEAMS_INVALID_RAID: (prefix) => `Raid inválido, su uso es \`${prefix}raidteams <raid> <fase>\`\n**Ejemplo:** \`${prefix}raidteams pit p3\``,
            COMMAND_RAIDTEAMS_INVALID_PHASE: (prefix) => `Fase inválida, su uso es \`${prefix}raidteams <raid> <fase>\`\n**Ejemplo:** \`${prefix}raidteams pit p3\``,
            COMMAND_RAIDTEAMS_PHASE_SOLO: 'Solo',
            COMMAND_RAIDTEAMS_PHASE_ONE: 'Phase 1',
            COMMAND_RAIDTEAMS_PHASE_TWO: 'Phase 2',
            COMMAND_RAIDTEAMS_PHASE_THREE: 'Phase 3',
            COMMAND_RAIDTEAMS_PHASE_FOUR: 'Phase 4',
            COMMAND_RAIDTEAMS_CHARLIST: (charList) => `**Personajes:** \`${charList}\``,
            COMMAND_RAIDTEAMS_SHOWING: (currentPhase) => `Mostrando equipos para ${currentPhase}`,
            COMMAND_RAIDTEAMS_NO_TEAMS: (currentPhase) => `No he podido encontrar ningún equipo para \`${currentPhase}\``,
            COMMAND_RAIDTEAMS_CODE_TEAMS: (raidName, currentPhase) => ` * ${raidName} * \n\n* Mostrando equipos para ${currentPhase}\n\n`,
            COMMAND_RAIDTEAMS_CODE_TEAMCHARS: (raidTeam, charList) => `### ${raidTeam} ### \n* Personajes: ${charList}\n`,
            COMMAND_RAIDTEAMS_HELP: {
                description: "Muestra algunos equipos que funcionan bien para cada tipo de raid.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';raidteams <raid> <fase>',
                        args: {
                            "raid": "La Raid la cual desear ver los equipos. (aat|pit|sith)",
                            "fase": "La fase la cual desear ver. (p1|p2|p3|p4|solo)"
                        }
                    }
                ]
            },

            // Randomchar Command
            COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `Lo siento, pero necesitas un número entre
number from 1-${maxChar} ahí.`,
            COMMAND_RANDOMCHAR_HELP: {
                description: "Elige hasta 5 personajes al azar para crear un escuadron.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';randomchar [númeroDePersonajes]',
                        args: {
                            "númeroDePersonajes": "El número de personajes que deseas que se elijan."
                        }
                    }
                ]
            },

            // Register Command
            COMMAND_REGISTER_MISSING_ARGS: 'Necesitas proporcionar un id de usuario (mención o ID), y un código de aliado',
            COMMAND_REGISTER_MISSING_ALLY: 'Necesitas proporcionar un código de aliado para vincularlo con tu cuenta.',
            COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `Lo siento, pero ${allyCode} no es un código de aliado válido`,
            COMMAND_REGISTER_PLEASE_WAIT: 'Por favor espera un poco mientras sincronizo tus datos.',
            COMMAND_REGISTER_ADD_NO_SERVER: 'Solo puedes añadir los usuarios que esten en tu servidor.',
            COMMAND_REGISTER_ALREADY_ADDED: (prefix=';') => `Este usuario ya esta registrado! Por favor usa \`${prefix}register update <usuario>\`.`,
            COMMAND_REGISTER_FAILURE: 'Registro fallido, por favor asegurate que tu código de aliado sea correcto.',
            COMMAND_REGISTER_SUCCESS: (user) => `El registro de \`${user}\` ha sido exitoso!`,
            COMMAND_REGISTER_UPDATE_FAILURE: 'Algo salió mal, asegurate que tu código de aliado registrado sea correcto.',
            COMMAND_REGISTER_UPDATE_SUCCESS: (user) => `Perfil de \`${user}\` actualizado.`,
            COMMAND_REGISTER_CANNOT_REMOVE: (prefix=';') => `No puedes eliminar otras personas. Si han abandonado tu gremio, prueba \`${prefix}register update <usuario>\`.`,
            COMMAND_REGISTER_NOT_LINKED: 'No tienes la cuenta vinculada a SWGoH.',
            COMMAND_REGISTER_REMOVE_SUCCESS: 'Desvinculación con éxito.',
            COMMAND_REGISTER_GUPDATE_SUCCESS: (guild) => `Gremio \`${guild}\` actualizado.`,
            COMMAND_REGISTER_HELP: {
                description: "Registra tu código de aliado con tu ID de Discord y sincroniza tu perfil en SWGoH.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: 'Vincula tu perfil en Discord con tu cuenta de SWGoH.',
                        usage: ';register add <usuario> <CódigoDeAliado>',
                        args: {
                            "usuario": "El usuario que se desea agregar. (me | userID | mention)",
                            "CódigoDeAliado": "Tu código de aliado dentro del juego."
                        }
                    },
                    {
                        action: "Update",
                        actionDesc: 'Actualiza/resincroniza tu información de SWGoH.',
                        usage: ';register update <usuario> [-guild]',
                        args: {
                            "usuario": "El usuario que quieres agregar. (me | userID | mention)",
                            "-guild": "Actualiza la información del gremio entero. (-g | -guild | -guilds)"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: 'Desvincula tu perfil de Discord de tu cuenta de SWGoH.',
                        usage: ';register remove <usuario>',
                        args: {
                            "usuario": "Lo desvincula en caso de que hayas usado un código de aliado erróneo. (me | userID | mención)"
                        }
                    }
                ]
            },



            // Reload Command
            COMMAND_RELOAD_INVALID_CMD: (cmd) => `No he podido encontrar el comando: ${cmd}`,
            COMMAND_RELOAD_SUCCESS: (cmd) => `Recargado con éxito: ${cmd}`,
            COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `Recarga del comando fallida: ${cmd}\n\`\`\`${stackTrace}\`\`\``,
            COMMAND_RELOAD_HELP: {
                description: "Vuelve a cargar el archivo del comando, si ha sido actualizado o modificado.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';reload <comando>',
                        args: {
                            "comando": "El comando que deseas volver a cargar."
                        }
                    }
                ]
            },

            // Reload Data Command
            COMMAND_RELOADDATA_HELP: {
                description: "Recarga el/los archivo(s) seleccionado(s).",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';reloaddata <opción>',
                        args: {
                            "opción": "Lo que deseas recargar ( commands | data | events | function )."
                        }
                    }
                ]
            },

            // Setconf Command
            COMMAND_SETCONF_MISSING_PERMS: `Lo siento, pero o bien no eres un Admin o el líder de tu servidor no ha inicializado las configuraciones.`,
            COMMAND_SETCONF_MISSING_OPTION: `Necesitas seleccionar la opción de configuración la cual deseas cambiar.`,
            COMMAND_SETCONF_MISSING_VALUE: `Necesitas asignar un valor para cambiar la opción.`,
            COMMAND_SETCONF_ARRAY_MISSING_OPT: 'Debes usar `add` o `remove`.',
            COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `Lo siento, pero \`${value}\` no está establecida en \`${key}\`.`,
            COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${value}\` ha sido ${action} por tu \`${key}\`.`,
            COMMAND_SETCONF_NO_KEY: (prefix) => `Este comando no está en la configuración. Echa un ojo en "${prefix}showconf", o "${prefix}setconf help" para ver una lista`,
            COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `El elemento de la configuración del Gremio${key} ha sido cambiado a:\n\`${value}\``,
            COMMAND_SETCONF_NO_SETTINGS: `Configuración del gremio no encontrada.`,

            COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `Debes especificar un rol a  ${opt}.`,
            COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Lo siento, pero no he podido encontrar el rol ${roleName}. Por favor inténtalo de nuevo .`,
            COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Lo siento, pero ${roleName} ya se encuentra actualmente.`,
            COMMAND_SETCONF_PREFIX_TOO_LONG: 'Lo siento, pero no puedes tener espacio en tu prefijo.',
            COMMAND_SETCONF_WELCOME_NEED_CHAN: `Lo siento, pero tu canal de eventos o bien no ha sido establecida o ya no es actualmente válida.\nEstablécelo con \`announceChan\` en un canal válido e inténtalo de nuevo.\``,
            COMMAND_SETCONF_TIMEZONE_NEED_ZONE: `Zona horaria inválida, mira aquí https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \ny encuentra la que necesites, luego introduce lo que aparece en la columna TZ.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Lo siento, pero no he podido encontrar el canal ${chanName}. Intentalo de nuevo.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: `Lo siento, pero no tengo permiso para enviar un mensaje ahí. Por favor cambia los permisos o bien elige otro canal.`,
            COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Lo siento, pero ${value} no es un lenguaje soportado actualmente. \nLos lenguajes soportados actualmente son: \`${langList}\``,
            COMMAND_SETCONF_RESET: `Tu configuración ha sido restablecida.`,
            COMMAND_SETCONF_HELP: {
                description: "Se usa para establecer los ajustes de configuración del bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';setconf <key> <value>',
                        args: {}
                    },
                    {
                        action: "prefix",
                        actionDesc: 'Establece el prefijo del bot en tu Servidor.',
                        usage: ';setconf prefix <prefix>',
                        args: {}
                    },
                    {
                        action: "adminRole",
                        actionDesc: 'El rol el cual deseas que sea capaz de modificar los ajustes del bot o establecer eventos.',
                        usage: ';setconf adminRole <add|remove> <rol>',
                        args: {
                            'add':  'Agrega un rol a la lista.',
                            'remove': 'Elimina un rol de la lista.'
                        }
                    },
                    {
                        action: "enableWelcome",
                        actionDesc: 'Activa/desactiva el mensaje de bienvenida.',
                        usage: ';setconf enableWelcome <true|false>',
                        args: {}
                    },
                    {
                        action: "welcomeMessage",
                        actionDesc: 'El mensaje de bienvenida para enviar si tienes la opción activada. (Variables especiales abajo).',
                        usage: ';setconf welcomeMessage <mensaje>',
                        args: {
                            '{{user}}':  "Es remplazado con el nombre del nuevo usuario.",
                            '{{userMention}}': "Menciona al nuevo usuario de ahí."
                        }
                    },
                    {
                        action: "enablePart",
                        actionDesc: 'Activa/desactiva el mensaje de despedida.',
                        usage: ';setconf enablePart <true|false>',
                        args: {}
                    },
                    {
                        action: "partMessage",
                        actionDesc: 'El mensaje de despedida a enviar si tienes la opción activada. (Variables especiales abajo)',
                        usage: ';setconf partMessage <mensaje>',
                        args: {
                            '{{user}}':  "Es remplazado con el nombre del nuevo usuario.",
                        }
                    },
                    {
                        action: "useEmbeds",
                        actionDesc: 'Activa/desactiva el uso de mensajes establecidos como salida para algunos comandos.',
                        usage: ';setconf useEmbeds <true|false>',
                        args: {}
                    },
                    {
                        action: "timezone",
                        actionDesc: 'Establece la zona horaria la cual deseas que todos los comandos relacionados con los horarios los usen. Mira aquí si necesitas una lista https://goo.gl/Vqwe49.',
                        usage: ';setconf timezone <zonaHoraria>',
                        args: {}
                    },
                    {
                        action: "announceChan",
                        actionDesc: 'Establece el nombre del canal de anuncios para eventos, etc. Asegúrate de que tenga permisos para enviar mensajes ahí.',
                        usage: ';setconf announceChan <NombreDelCanal>',
                        args: {}
                    },
                    {
                        action: "useEventPages",
                        actionDesc: 'Establece que los eventos se muestren en páginas en vez de "Mega-Spammeados XD".',
                        usage: ';setconf useEventPages <true|false>',
                        args: {}
                    },
                    {
                        action: "eventCountdown",
                        actionDesc: 'El horario en el que deseas que aparezca un mensaje de cuenta atrás.',
                        usage: ';setconf eventCountdown <add|remove> <horario>',
                        args: {
                            'add':  'Agrega un horario a la lista.',
                            'remove': 'Elimina un horario de la lista.'
                        }
                    },
                    {
                        action: "language",
                        actionDesc: 'Establece el bot para usarlo en cualquier lenguaje soportado para la salida de comandos.',
                        usage: ';setconf language <lang>',
                        args: {}
                    },
                    {
                        action: "swgohLanguage",
                        actionDesc: 'Configura el bot para usar cualquier lenguaje soportado para la información de salida del juego.',
                        usage: ';setconf swgohLanguage <lang>',
                        args: {}
                    },
                    // {
                    //     action: "reset",
                    //     actionDesc: 'Resetea la configuración de vuelta por defecto (Solo si estás seguro)',
                    //     usage: ';setconf reset',
                    //     args: {}
                    // }
                ]
            },

            // Shard times command
            COMMAND_SHARDTIMES_MISSING_USER: `Necesito un usuario, por favor introduce "me", menciona a alguien aquí o introduce su ID del Discord.`,
            COMMAND_SHARDTIMES_MISSING_ROLE: `Lo siento, pero solo puedes agregarte a ti mismo a menos que tengas un rol de Admin.`,
            COMMAND_SHARDTIMES_INVALID_USER: `Usuario inválido, por favor introduce "me", menciona a alguien aquí o introduce su ID del Discord.`,
            COMMAND_SHARDTIMES_MISSING_TIMEZONE: `Necesitas ingresar una zona horaria.`,
            COMMAND_SHARDTIMES_INVALID_TIMEZONE: `Zona horaria inválida, busca aquí https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \ny encuentra la que necesites, después introduce lo que aparece en la columna TZ.`,
            COMMAND_SHARDTIMES_USER_ADDED: `Usuario agregado con éxito!`,
            COMMAND_SHARDTIMES_USER_NOT_ADDED: `Algo salió mal mientras se agregaba este usuario. Por favor inténtalo de nuevo.`,
            COMMAND_SHARDTIMES_REM_MISSING_PERMS: `Lo siento, pero solo te puedes eliminar a ti mismo a menos que tengas un rol de Admin.`,
            COMMAND_SHARDTIMES_REM_SUCCESS: `Usuario eliminado con éxito!`,
            COMMAND_SHARDTIMES_REM_FAIL: `Algo salió mal mientras se eliminaba este usuario. Por favor inténtalo de nuevo.`,
            COMMAND_SHARDTIMES_REM_MISSING: `Lo siento, pero este usuario parece no estar aquí.`,
            COMMAND_SHARDTIMES_SHARD_HEADER: `Recompensa de fragmentos en:`,
            COMMAND_SHARDTIMES_HELP: {
                description: "Muestra una lista con el tiempo restante hasta el próximo cobro de recompensas de cualquier usuario registrado.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: 'Agrega un usuario al rastreador de fragmentos.',
                        usage: ';Tiempo de cobro añade <usuario> <zonaHoraria> [flag/emoji]',
                        args: {
                            "usuario": "El usuario que se desea agregar. (me | userID | mention)",
                            "zonaHoraria": "La zona horaria en la que se encuentra tu cuenta",
                            "bandera/emoji": "(Opcional) muestra un emoji de tu elección al lado de tu nombre."}
                    },
                    {
                        action: "Remove",
                        actionDesc: 'Elimina el rastreador de un usuario.',
                        usage: ';Eliminar tiempo de cobro <usuario>',
                        args: {
                            "usuario": "El usuario que estás añadiendo. (me | userID | mention)"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'Muestra todos los horarios marcados para ti y tus compañeros.',
                        usage: ';shardtimes view',
                        args: {}
                    }
                ]
            },

            // Ships Command
            COMMAND_SHIPS_NEED_CHARACTER: (prefix) => `Se Necesita un personaje o una nave. Su uso es \`${prefix}ship <nave|piloto>\``,
            COMMAND_SHIPS_INVALID_CHARACTER: (prefix) => `Personaje o nave inválida. Su uso es \`${prefix}ship <nave|piloto>\``,
            COMMAND_SHIPS_TOO_MANY: `He encontrado más de un resultado en esta búsqueda. Por favor intenta ser más específico.`,
            COMMAND_SHIPS_CREW: 'Tripulación',
            COMMAND_SHIPS_FACTIONS: 'Facciones',
            COMMAND_SHIPS_ABILITIES: (abilities) => `**Tipo de Habilidad:** ${abilities.type}   **Tiempo restante de habilidad:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
            COMMAND_SHIPS_CODE_ABILITES_HEADER: ` * Habilidades *\n`,
            COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nAbility Tipo: ${abilities.type}   Ability Cooldown: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
            COMMAND_SHIPS_HELP: {
                description: "Muestra información sobre la nave seleccionada.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'ship <nave|piloto>',
                        args: {
                            "nave|piloto": "La nave o el piloto de la nave la cual deseas mostrar información."
                        }
                    }
                ]
            },

            // Showconf Command
            COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `La siguiente es la configuración actual de ${serverName}: \`\`\`${configKeys}\`\`\``,
            COMMAND_SHOWCONF_HELP: {
                description: "Muestra la configuración actual de tu servidor.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';showconf',
                        args: {}
                    }
                ]
            },

            // Squads Command
            COMMAND_SQUADS_NO_LIST: (list) => `Por favor selecciona una categoria de la siguiente lista: \n\`${list}\``,
            COMMAND_SQUADS_SHOW_LIST: (name, list) => `Dentro ${name}, por favor selecciona el número correspondiente a la fase que quieres ver: \n${list}`,
            COMMAND_SQUADS_FIELD_HEADER: 'Escuadrón/ Personajes',
            COMMAND_SQUAD_INVALID_PHASE: (list) => `Número de fase inválido, por favor selecciona uno de los siguientes: \n${list}`,
            COMMAND_SQUADS_HELP: {
                description: "Muestra los personajes/ escuadrones que son útiles para varios eventos.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';squads [user] <event> <phaseNum>',
                        args: {
                            "user": "La persona la cual añades. (me | userID | mention)",
                            "event": "El evento el cual quieres ver sus equipos. (aat|pit|sith|etc.)",
                            "phase": "El número asociado a la fase la cual quieres ver"
                        }
                    }
                ]
            },
            // Stats Command
            COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID) => `= ESTADÍSTICAS (${shardID}) =\n
• Uso de Mem.    :: ${memUsage} MB
• Carga CPU      :: ${cpuLoad}%
• Tiempo Activo. :: ${uptime}
• Usuarios       :: ${users}
• Servidores     :: ${servers}
• Canales        :: ${channels}
• Link         :: https://github.com/jmiln/SWGoHBot`,
            COMMAND_STATS_HELP: {
                description: "Muestra las estadísticas del bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';stats',
                        args: {}
                    }
                ]
            },

            // Test command (in .gitignore)
            COMMAND_TEST_HELP: {
                description: "Un comando para poner a prueba las cosas.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';test',
                        args: {}
                    }
                ]
            },

            // Time Command
            COMMAND_TIME_CURRENT: (time, zone) => `La hora actual es: ${time} en ${zone}`,
            COMMAND_TIME_INVALID_ZONE: (time, zone) => `Zona horaria inválida, esta es la hora de tu gremio  ${time} en ${zone}`,
            COMMAND_TIME_NO_ZONE: (time) => `La hora actual es: ${time} UTC`,
            COMMAND_TIME_WITH_ZONE: (time, zone) => `La hora actual es: ${time} en ${zone} 
time`,
            COMMAND_TIME_HELP: {
                description: "Permite comprobar el tiempo de la zona horaria configurada del gremio.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';time [zonaHoraria]',
                        args: {
                            "timezone": "Opcional si deseas conocer que tiempo es en cualquier otro sitio."
                        }
                    }
                ]
            },

            // Updatechar Command
            COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `Lo siento, pero ${arg} no es un argumento válido. Prueba con alguno de estos: ${usableArgs}`,
            COMMAND_UPDATECHAR_NEED_CHAR: `Necesitas especificar un personaje el cual actualizar.`,
            COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Lo siento, pero la búsqueda para '${charName}' no ha producido ningún resultado. Por favor inténtalo de nuevo.`,
            COMMAND_UPDATECHAR_HELP: {
                description: "Actualiza la información de un personaje en específico.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';updatechar [gear|info|mods] [charater]',
                        args: {
                            "gear": "Actualiza el equipo (gear) del personaje.",
                            "info": "Actualiza la información del personaje (Enlace de la imagen, habilidades, etc.)",
                            "mods": "Actualiza los mods desde crouchingrancor.com"
                        }
                    }
                ]
            },

            // UpdateClient Command
            COMMAND_UPDATECLIENT_HELP: {
                description: "Actualiza el cliente para SWGoHAPI.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';updateclient',
                        args: {}
                    }
                ]
            },

            // Zetas Command
            COMMAND_ZETA_NO_USER: `Lo siento, pero no tengo a ese usuario enlistado en ninguna parte.`,
            COMMAND_ZETA_NO_ZETAS: 'Parece que no tienes ninguna habilidad con Zeta',
            COMMAND_ZETA_OUT_DESC: `\`${'-'.repeat(30)}\`\n\`[L]\` Líder | \`[E]\` Especial | \`[U]\` Única\n\`${'-'.repeat(30)}\``,
            COMMAND_ZETAS_HELP: {
                description: "Muestra las habilidades de las zetas que tienes.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';zeta [usuario]',
                        args: {
                            "usuario": "El usuario el cual estás añadiendo. (me | userID | mention)"
                        }
                    }
                ]
            }
        };
    }
};


