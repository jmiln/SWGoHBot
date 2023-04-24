const Language = require("../base/Language.js");
const langList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];
const swgohLangList = ["de_DE", "en_US", "es_SP", "ko_KR", "pt_BR"];
const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: "So",
        LONG: "Sonntag"
    },
    MONDAY: {
        SHORT: "Mo",
        LONG: "Montag"
    },
    TUESDAY: {
        SHORT: "Di",
        LONG: "Dienstag"
    },
    WEDNESDAY: {
        SHORT: "Mi",
        LONG: "Mittwoch"
    },
    THURSDAY: {
        SHORT: "Do",
        LONG: "Donnerstag"
    },
    FRIDAY: {
        SHORT: "Fr",
        LONG: "Freitag"
    },
    SATURDAY: {
        SHORT: "Sa",
        LONG: "Samstag"
    }
};
const TIMES = {
    DAY: {
        PLURAL: "Tage",
        SING: "Tag",
        SHORT_PLURAL: "T",
        SHORT_SING: "T"
    },
    HOUR: {
        PLURAL: "Stunden",
        SING: "Stunde",
        SHORT_PLURAL: "Std",
        SHORT_SING: "Std"
    },
    MINUTE: {
        PLURAL: "Minuten",
        SING: "Minute",
        SHORT_PLURAL: "Min",
        SHORT_SING: "Min"
    },
    SECOND: {
        PLURAL: "Sekunden",
        SING: "Sekunde",
        SHORT_PLURAL: "Sek",
        SHORT_SING: "Sek"
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
            BASE_DEFAULT_MISSING: "Es wird versucht eine nicht vorhandene Zeichenkette zu verwenden. Wenn du diese Info siehst, dann bitte melden damit es gefixt werden kann.",

            // Base swgohBot.js file
            BASE_LAST_EVENT_NOTIFICATION: "\n\nDas ist der letzte Eintrag fuer dieses Event. Um weiterhin diese Ankuendigung zu erhalten, erstelle ein neues Event.",
            BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nStartet in ${timeToGo}`,
            BASE_EVENT_LATE: "Entschuldigung, aber dieses Event wurde spaeter als erwartet getriggert. Wenn eine Wiederholung eingestellt wurde (repeat) wird die naechste Ankuendigung rechtzeitig erscheinen.",

            // Base swgohAPI
            BASE_SWGOH_NO_ALLY: (prefix=";") => `Entschuldigung, aber dieser User ist nicht registriert. Bitte registrieren mit \`${prefix}userconf allycode add  <allycode>\``,
            BASE_SWGOH_NOT_REG: (user, prefix=";") => `Entschuldigung, aber dieser User ist nicht registriert. Bitte registrieren mit \`${prefix}userconf allycode add <allycode>\``,
            BASE_SWGOH_NO_USER: (prefix) => `Entschuldigung, aber ich habe diesen User nirgends gelistet. Bitte registrieren mit \`${prefix}userconf allycode add  <allycode>\``,
            BASE_SWGOH_NO_GUILD_FOR_USER: (prefix=";") => `Ich kann für diesen User keine Gilde finden. Bitte registrieren mit \`${prefix}userconf allycode add  <allycode>\``,
            BASE_SWGOH_NO_GUILD: "Ich kann für diese Gilde keinen User finden.\nBitte sicherstellen, dass der Name korrekt geschrieben ist und dass die Gross- und Kleinschreibung stimmt.",
            BASE_SWGOH_MISSING_CHAR: "Du musst einen Charakter angeben",
            BASE_SWGOH_NO_CHAR_FOUND: (character) => `Kein Ergebnis gefunden fuer ${character}`,
            BASE_SWGOH_CHAR_LIST: (chars) => `Deine Suche ergab zu viele Treffer, bitte sei spezifischer. \nHier ist eine Liste mit den besten Treffern.\n\`\`\`${chars}\`\`\``,
            BASE_SWGOH_NO_ACCT: "Etwas ist schief gegangen, bitte sicherstellen dass dein Account korrekt synchronisiert wurde.",
            BASE_SWGOH_LAST_UPDATED: (date) => `Zuletzt aktualisiert vor ${date}`,
            BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `Bitte warten waehrend ich aktualisiere ${dType ? dType : "Daten"}`,
            BASE_SWGOH_NAMECHAR_HEADER: (name, char) => `${name}'s ${char}`,
            BASE_SWGOH_NAMECHAR_HEADER_NUM: (name, char, num) => `${name}'s ${char} (${num})`,
            BASE_SWGOH_LOCKED_CHAR: "Entschuldige, aber sieht so aus als ob du diesen Charakter noch nicht freigeschalten hast",
            BASE_SWGOH_GUILD_LOCKED_CHAR: "Entschuldige, aber es sieht so aus als ob niemand in deiner Gilde diesen Charakter freigeschaltet hat",

            // Generic (Not tied to a command)
            COMMAND_EXTENDED_HELP: (command) => `**Erweiterte Hilfe fuer ${command.help.name}** \n**Verwendung**: ${command.help.usage} \n${command.help.extended}`,
            COMMAND_INVALID_BOOL: "Ungueltiger Wert, versuche true oder false",
            COMMAND_MISSING_PERMS: "Entschuldigung, aber Sie haben nicht die richtigen Berechtigungen, um das zu verwenden.",
            BASE_CANNOT_DM: "Entschuldigung, aber ich konnte Dir keine Nachricht senden. Bitte pruefe Deine Einstellungen, ob du es erlaubt hast, dass Leute auf diesem Server Dir Nachrichten senden duerfen.",
            BASE_COMMAND_UNAVAILABLE: "Dieser Befehl ist ueber Privatnachrichten nicht verfuegbar. Bitte fuehre diesen Befehl innerhalb eines Gildenservers aus.",
            BASE_COMMAND_HELP_HEADER: (name) => `Hilfe fuer ${name}`,
            BASE_COMMAND_HELP_HEADER_CONT: (name) => `Fortgesetzte Hilfe fuer ${name}`,
            BASE_CONT_STRING: "(cont)",
            BASE_COMMAND_HELP_HELP: (name) => {
                return {
                    action: "Help",
                    actionDesc: "Zeigt diese Hilfe an.",
                    usage: `;${name} help`,
                    args: {}
                };
            },
            BASE_MOD_TYPES: {
                SQUARE:  "Viereck",
                ARROW:   "Pfeil",
                DIAMOND: "Diamant",
                TRIANGLE:"Dreieck",
                CIRCLE:  "Kreis",
                CROSS:   "Kreuz",
                ACCURACY:   "Praezision",
                CRITCHANCE: "Krit Chance",
                CRITDAMAGE: "Krit Schaden",
                DEFENSE:    "Abwehr",
                HEALTH:     "Gesundheit",
                OFFENSE:    "Angriff",
                POTENCY:    "Effektivitaet",
                SPEED:      "Tempo",
                TENACITY:   "Zaehigkeit"
            },
            BASE_MODSETS_FROM_GAME: {
                1: "Gesundheit",
                2: "Angriff",
                3: "Abwehr",
                4: "Tempo",
                5: "Krit Chance",
                6: "Krit Schaden",
                7: "Effektivitaet",
                8: "Zaehigkeit"
            },
            BASE_MODS_FROM_GAME: {
                "UNITSTATEVASIONNEGATEPERCENTADDITIVE": "Praezision %",
                "UNITSTATCRITICALCHANCEPERCENTADDITIVE": "Krit Chance %",
                "UNITSTATCRITICALDAMAGE": "Krit Schaden %",
                "UNITSTATCRITICALNEGATECHANCEPERCENTADDITIVE": "Krit Ausweichen",
                "UNITSTATDEFENSE": "Abwehr",
                "UNITSTATDEFENSEPERCENTADDITIVE": "Abwehr %",
                "UNITSTATACCURACY": "Effektivitaet %",
                "UNITSTATMAXHEALTH": "Gesundheit",
                "UNITSTATMAXHEALTHPERCENTADDITIVE": "Gesundheit %",
                "UNITSTATMAXSHIELD": "Schutz",
                "UNITSTATMAXSHIELDPERCENTADDITIVE": "Schutz %",
                "UNITSTATOFFENSE": "Angriff",
                "UNITSTATOFFENSEPERCENTADDITIVE": "Angriff %",
                "UNITSTATRESISTANCE": "Zaehigkeit %",
                "UNITSTATSPEED": "Tempo"
            },
            BASE_STAT_NAMES: {
                PRIMARY:    "Primaerwert",
                STRENGTH:   "Kraft",
                AGILITY:    "Geschicklichkeit",
                TACTICS:    "Taktik",
                GENERAL:    "Allgemein",
                HEALTH:     "Gesundheit",
                PROTECTION: "Schutz",
                SPEED:      "Tempo",
                CRITDMG:    "Kritischer Schaden",
                POTENCY:    "Effektivitaet",
                TENACITY:   "Zaehigkeit",
                HPSTEAL:    "Gesundheitsentzug",
                DEFENSEPEN: "Verteidigungsdurchdr.",
                PHYSOFF:    "Koerperlicher Angriff",
                PHYSDMG:    "Koerperl. Schaden",
                PHYSCRIT:   "Koerperl. Krit. Chance",
                ARMORPEN:   "Ruestungsdurchdringung",
                ACCURACY:   "Praezision",
                PHYSSURV:   "Koerperl. Ueberlebensfaehigkeit",
                ARMOR:      "Ruestung",
                DODGECHANCE:"Ausweichchance",
                CRITAVOID:  "Kritisches Ausweichen",
                SPECOFF:    "Angriff (Spezial)",
                SPECDMG:    "Schaden (Spezial)",
                SPECCRIT:   "Krit. Chance (Spezial)",
                RESPEN:     "Resistenzdurchdringung",
                SPECSURV:   "Ueberlebensfaehigkeit (Spezial)",
                RESISTANCE: "Resistenz",
                DEFLECTION: "Ablenkungschance"
            },
            BASE_LEVEL_SHORT: "lvl",
            BASE_GEAR_SHORT: "Ausruestung",
            BASE_SOMETHING_BROKE: "Etwas funktioniert nicht",
            BASE_SOMETHING_BROKE_GUILD: "Etwas hat beim holen deiner Gildeninformationen nicht geklappt",
            BASE_SOMETHING_BROKE_GUILD_ROSTER: "Etwas hat beim holen der Gilden-Mitgliederliste nicht geklappt",
            BASE_PLEASE_TRY_AGAIN: "Bitte versuche es etwas später nocheinmal.",

            // Abilities Command
            COMMAND_CHARACTER_NEED_CHARACTER: (prefix) => `Ein Charakter wird benoetigt. \n Verwendung \`${prefix}abilities <CharakterName auf englisch>\``,
            COMMAND_CHARACTER_INVALID_CHARACTER: (prefix) => `Ungueltiger Charakter. \nVerwendung \`${prefix}abilities <CharakterName auf englisch>\``,
            COMMAND_CHARACTER_COOLDOWN: (aCooldown) => `**Abklingzeit Faehigkeit:** ${aCooldown}\n`,
            COMMAND_CHARACTER_ABILITY: (aType, mat, cdString, aDesc) => `**Faehigkeiten-Typ:** ${aType}\n**Faehigkeitenmaterial benoetigt:     ${mat}**\n${cdString}${aDesc}`,
            COMMAND_CHARACTER_HELP: {
                description: "Zeigt die Faehigkeiten für einen spezifizierten Charakter.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";abilities <Charaktername>",
                        args: {}
                    }
                ]
            },

            //Acronym Command
            COMMAND_ACRONYMS_INVALID: "Es fehlt das Akronym nach dem gesucht werden soll",
            COMMAND_ACRONYMS_NOT_FOUND: "Akronym konnte nicht gefunden werden.",
            COMMAND_ACRONYMS_HELP: {
                description: "Hilfe um nach gebraeuchlichen Akronymen in Star Wars: Galaxy of Heroes zu suchen.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";acronym zu suchendes Akronym\n;acronym oder mehrere Akronyme",
                        args: {}
                    }
                ]
            },

            // Activities Command
            COMMAND_ACTIVITIES_SUNDAY: "== Bis Reset == \nArena Kaempfe kaempfen \nCantina Energie sparen \nNormale Energie sparen\n\n== Nach Reset == \nCantina Energie verwenden \nNormale Energie sparen",
            COMMAND_ACTIVITIES_MONDAY: "== Bis Reset == \nCantina Energie ausgeben \nNormale Energie sparen \n\n== Nach Reset == \nNormale Energie fuer Kaempfe der hellen Seite verwenden ",
            COMMAND_ACTIVITIES_TUESDAY: "== Bis Reset == \nNormale Energie fuer Kaempfe der hellen Seite verwenden \n Alle anderen Arten von Energie sparen \n\n== Nach Reset == \nSaemtliche Energie ausgeben ",
            COMMAND_ACTIVITIES_WEDNESDAY: "== Bis Reset == \nSaemtliche Energie (außer Normal) ausgeben \nNormale Energie sparen\n\n== Nach Reset == \nNormale Energie fuer Harte Kaempfe verwenden",
            COMMAND_ACTIVITIES_THURSDAY: "== Bis Reset == \nNormale Energie fuer Harte Kaempfe verwenden \nHerausforderungen sparen\n\n== Nach Reset == \nAlle Herausforderungen beenden / kaempfen \nNormale Energie sparen",
            COMMAND_ACTIVITIES_FRIDAY: "== Bis Reset == \nAlle Herausforderungen beenden / kaempfen \nNormale Energie spare\n\n== Nach Reset == \nNormale Energie fuer Kaempfe der dunklen Seite verwenden",
            COMMAND_ACTIVITIES_SATURDAY: "== Bis Reset == \nNormale Energie fuer Kaempfe der dunklen Seite verwenden \nArena Kaempfe sparen \nCantina Energie sparen\n\n== Nach Reset == \nArena Kaempfe kaempfen\nCantina Energie sparen",
            COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Ungueltiger Tag, Verwendung lautet \`${prefix}${usage}\``,
            COMMAND_ACTIVITIES_HELP: {
                description: "Zeigt die taeglichen Aktivitaeten der Gilde an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";activities [Wochentag]",
                        args: {}
                    }
                ]
            },

            // Arenarank Command
            COMMAND_ARENARANK_INVALID_NUMBER: "Bitte einen gueltigen Rang angeben",
            COMMAND_ARENARANK_BEST_RANK: "Weiter kommt man nicht, gratuliere!",
            COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `Von Rang ${currentRank}, in ${battleCount} battle${plural} ${est}\nDie bestmoegliche Platzierung ist ${rankList}`,
            COMMAND_ARENARANK_HELP: {
                description: "Zeigt den (vermutlich) hoechsten Rang an, der erreicht werden kann, wenn jeder Arenakampf gewonnen wird.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";arenarank <aktuellerRang> [Anzahl Kaempfe]",
                        args: {}
                    }
                ]
            },

            // Challenges Command
            COMMAND_CHALLENGES_TRAINING: "Trainingsdroiden",
            COMMAND_CHALLENGES_ABILITY : "Faehigkeitenfundament",
            COMMAND_CHALLENGES_BOUNTY  : "Kopfgeldjaeger",
            COMMAND_CHALLENGES_AGILITY : "GES-Ausruestung",
            COMMAND_CHALLENGES_STRENGTH: "KRA-Ausruestung",
            COMMAND_CHALLENGES_TACTICS : "Tak-Ausruestung",
            COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "Schiffsaufwertungsdroiden",
            COMMAND_CHALLENGES_SHIP_BUILDING   : "Schiffbaumaterialien",
            COMMAND_CHALLENGES_SHIP_ABILITY    : "Schiff-Faehigkeitsmaterialien",
            COMMAND_CHALLENGES_MISSING_DAY: "Ein Tag muss spezifziert werden",
            COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `Ungueltiges Datum, der Befehl lautet: \`${prefix}${usage}\``,
            COMMAND_CHALLENGES_HELP: {
                description: "Zeigt die taeglichen Herausforderungen der Gilde an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";challenges <Wochentag>",
                        args: {}
                    }
                ]
            },

            // Changelog Command (Help)
            COMMAND_CHANGELOG_HELP: {
                description: "Fuegt eine Logdatei zur DB hinzu und fuegt diese dem Changelog-Kanal hinzu.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "changelog <Nachricht>",
                        args: {
                            "Nachricht": "Benutze [Updated], [Changed], [Fixed], [Removed], und [Added] um die Aenderungen zu organisieren."
                        }
                    }
                ]
            },

            // Character gear Command
            COMMAND_CHARGEAR_NEED_CHARACTER: (prefix) => `Benoetigt Charakter. Der Befehl lautet: \`${prefix}charactergear <Charakter> [GearLvl]\``,
            COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix) => `Ungueltiger Charakter. Der Befehl lautet: \`${prefix}charactergear <Charakter> [GearLvl]\``,
            COMMAND_CHARGEAR_INVALID_GEAR: "Ungueltiges Gearlevel. Gueltige Gearlevel liegen zwischen 1 & 12.",
            COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### Komplette benoetigte Ausruestung ### \n${gearString}`,
            COMMAND_CHARGEAR_GEAR_NA: "Diese Ausruestung wurde nicht eingefuegt",
            COMMAND_CHARACTERGEAR_HELP: {
                description: "Zeigt die Gearanforderungen für den spezifizierten Charakter / Level.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "charactergear <charakter auf englisch> [gearLvl]",
                        args: {
                            "charakter auf englisch": "Der Charakter fuer den du die Ausruestung suchst",
                            "gearLvl": "Wenn du die Ausruestung einer bestimmten Stufe sehen willst"
                        }
                    },
                    {
                        action: "Pruefe deinen eigenen Ausruestungsbedarf",
                        actionDesc: "",
                        usage: "charactergear [user] <Charakter auf englisch> [gearLvl]",
                        args: {
                            "user": "Den Spieler dessen Ausruestung du sehen moechtest (me | userID | mention)",
                            "Charakter auf englisch": "Den Charakter dessen Ausruestung du sehen moechtest",
                            "gearLvl": "Wenn du die gesamte Ausruestung bis zu einer bestimmten Ausruestungsstufe sehen moechtest"
                        }
                    }
                ]
            },

            // Command Report Command
            COMMAND_COMMANDREPORT_HELP: ({
                description: "Zeigt eine Liste aller Befehle an, die in den letzten 10 Tagen ausgefuehrt wurden.",
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
            COMMAND_CURRENTEVENTS_HEADER: "SWGoH Events Plan",
            COMMAND_CURRENTEVENTS_DESC: (num) => `Die naechsten ${num} Events.\nNotiz: *Die Termine koennen sich ggf. noch aendern.*`,
            COMMAND_CURRENTEVENTS_HELP: {
                description: "Zeigt die naechsten geplanten Events an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";currentevents [num]",
                        args: {
                            "num": "Die maximale Anzahl von Events die du anzeigen moechtest."
                        }
                    }
                ]
            },

            // Event Command (Create)
            COMMAND_EVENT_INVALID_ACTION: (actions) => `Gueltige Aktionen sind\`${actions}\`.`,
            COMMAND_EVENT_INVALID_PERMS: "Entschuldigung, aber entweder bist du kein Admin, oder der Server Admin hat die noetigen Konfigurationen nicht vorgenommen..\nDu kannst keine Events erstellen oder entfernen, solange du keine Admin Rolle inne hast.",
            COMMAND_EVENT_ONE_REPEAT: "Entschuldigung, aber du musst entweder `repeat` oder `repeatDay` in einem Event nutzen. Bitte benutze das Eine oder das Andere.",
            COMMAND_EVENT_INVALID_REPEAT: "Die Wiederholung ist im falschen Format. Beispiel: ˋ5d3h8mˋ steht fuer 5 Tage 3 Stunden und 8 Minuten",
            COMMAND_EVENT_USE_COMMAS: "Bitte benutze Komma getrennte Nummern fuer repeatDay. Beispiel: `1,2,1,3,4`",
            COMMAND_EVENT_INVALID_CHAN: "Dieser Kanal ist ungueltig. Bitte erneut versuchen",
            COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `Ich habe keine Berechtigung in ${channel} Nachrichten zu senden, bitte waehle einen Kanal, wo ich es kann`,
            COMMAND_EVENT_NEED_CHAN: "Du musst einen Kanal angeben der genutzt werden soll. Konfiguriere ˋannounceChanˋ zum erstellen von Events..",
            COMMAND_EVENT_NEED_NAME: "Du musst dem Event einen Namen geben.",
            COMMAND_EVENT_EVENT_EXISTS: "Dieser Eventname existiert bereits. Erneutes anlegen nicht moeglich.",
            COMMAND_EVENT_NEED_DATE: "Du musst ein Datum fuer dein Event angeben. Akzeptiertes Format ist `DD/MM/YYYY`.",
            COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate} ist kein gueltiges Datum. Akzeptiertes Format ist \`DD/MM/YYYY\`.`,
            COMMAND_EVENT_NEED_TIME: "Du musst fuer dein Event eine Zeit angeben.",
            COMMAND_EVEMT_INVALID_TIME: "Du musst fuer dein Event eine gueltige Zeit angeben. Akzeptiertes Format ist `HH:MM`, bei Nutzung vom 24 Stunden-Format. Aber nicht beim 12 Stunden-Format wie AM und PM",
            COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `Du kannst kein Event in der Vergangenheit anlegen. ${eventDATE} ist vor dem heutigen ${nowDATE}`,
            COMMAND_EVENT_CREATED: (eventName, eventDate) => `Event \`${eventName}\` fuer ${eventDate} angelegt`,
            COMMAND_EVENT_NO_CREATE: "Event konnte nicht angelegt werden, bitte erneut versuchen.",
            COMMAND_EVENT_TOO_BIG:(charCount) => `Entschuldigung, aber entweder ist der Eventname oder die Eventnachricht zu lang. Bitte kuerze diese um mindestens ${charCount} Zeichen.`,

            // Event Command (Create -json)
            COMMAND_EVENT_JSON_INVALID_NAME: "Ungueltiger oder fehlender Eventname",
            COMMAND_EVENT_JSON_NO_SPACES: "Eventname darf keine Leerzeichen enthalten. Du kannst stattdessen entweder _ oder - verwenden.",
            COMMAND_EVENT_JSON_EXISTS: "Es existiert bereits ein Event mit diesem Namen",
            COMMAND_EVENT_JSON_DUPLICATE: "Du kannst keine 2 Events mit dem gleichen Namen erstellen",
            COMMAND_EVENT_JSON_MISSING_DAY: "Datum fehlt (DD/MM/YYYY)",
            COMMAND_EVENT_JSON_INVALID_DAY: (day) => `Ungueltiger Tag (${day}). Muss in diesem Format sein DD/MM/YYYY`,
            COMMAND_EVENT_JSON_MISSING_TIME: "Uhrzeit fehlt (HH:MM)",
            COMMAND_EVENT_JSON_INVALID_TIME: (time) => `Ungueltige Uhrzeit (${time}). Muss in diesem 24 Stunden Format sein HH:MM`,
            COMMAND_EVENT_JSON_INVALID_CHANNEL: (chan) => `Ungueltiger Kanal (${chan}), falsche ID oder Kanal ist auf diesem Server nicht vorhanden`,
            COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS: (chan) => `Ungueltiger Kanal (${chan}). Ich habe keine Berechtigung um dort zu schreiben.`,
            COMMAND_EVENT_JSON_NO_2X_REPEAT: "Du kannst repeat & repeatDay nicht gleichzeitig verwenden",
            COMMAND_EVENT_JSON_BAD_NUM: "Alle Ziffern in repeatDay muessen groesser als 0 sein",
            COMMAND_EVENT_JSON_BAD_FORMAT: "RepeatDay muss einen Bereich von Tagen definieren (Bspw: `[1,2,5,1,4]`)",
            COMMAND_EVENT_JSON_COUNTDOWN_BOOL: "Countdown muss entweder wahr oder falsch sein",
            COMMAND_EVENT_JSON_ERROR_LIST: (num, list) => `Event #${num}    ERROR(s)\n${list}`,
            COMMAND_EVENT_JSON_EVENT_VALID: (num, name, time, day) => `Event #{num} gueltig\nName: ${name}\nZeit: ${time} am ${day}`,
            COMMAND_EVENT_JSON_ERR_NOT_ADDED: (list) => `**Eines oder mehrere Events haben Fehler, also wurde keines hinzugefuegt:**${list}`,
            COMMAND_EVENT_JSON_EV_ADD_ERROR: (name, msg) => `Fehler beim erstellen von Event \`${name}\` ${msg}`,
            COMMAND_EVENT_JSON_YES_NO: (errCount, errLog, addCount, addLog) => `**${errCount} Events die nicht erstellt werden konnten**\n${errLog}\n**${addCount} Hinzugefuegt**\n${addLog}`,
            COMMAND_EVENT_JSON_ADDED: (count, log) => `**${count} Events die erfolgreich erstellt wurden:**\n${log}`,
            COMMAND_EVENT_JSON_BAD_JSON: "Wenn du den Parameter `-json` verwendest, muss ein gueltiger json innerhalb des Codeblocks stehen",

            // Event Command (View)
            COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \nEvent Zeit: ${eventDate}\n`,
            COMMAND_EVENT_TIME_LEFT: (timeLeft) => `Verbleibende Zeit: ${timeLeft}\n`,
            COMMAND_EVENT_CHAN: (eventChan) => `Sende an Kanal: ${eventChan}\n`,
            COMMAND_EVENT_SCHEDULE: (repeatDays) => `Wiederholung: ${repeatDays}\n`,
            COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `Wiederhole alle ${eventDays} Tage, ${eventHours} Stunden und ${eventMins} Minuten\n`,
            COMMAND_EVENT_MESSAGE: (eventMsg) => `Event Nachricht: \n\`\`\`md\n${eventMsg}\`\`\``,
            COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `Event konnte nicht gefunden werden \`${eventName}\``,
            COMMAND_EVENT_NO_EVENT: "Es gibt aktuell keine geplanten Events.",
            COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `Hier ist der Eventplan \n(${eventCount} Gesamtevents: ${eventCount > 1 ? "s" : ""}) Seite ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`,
            COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `Hier ist der Eventplan \n(${eventCount} Events): \n${eventKeys}`,

            // Event Command (Delete)
            COMMAND_EVENT_DELETE_NEED_NAME: "Es muss ein Eventname zum loeschen angegeben werden.",
            COMMAND_EVENT_DOES_NOT_EXIST: "Dieses Event existiert nicht.",
            COMMAND_EVENT_DELETED: (eventName) => `Geloeschtes Event: ${eventName}`,

            // Event Command (Trigger)
            COMMAND_EVENT_TRIGGER_NEED_NAME: "Es muss ein Event angegeben werden.",

            // Event Command (Other)
            COMMAND_EVENT_TOO_MANY_EVENTS: "Entschuldige, aber du kannst nur bis zu 50 Events haben",

            // Event Command (Edit)
            COMMAND_EVENT_EDIT_MISSING_ARG: "Es fehlt ein Feld zum Editieren",
            COMMAND_EVENT_EDIT_INVALID_ARG: (target, changable) => `${target} ist kein gueltiges Feld. Versuche es mit einem von diesen:\n\`${changable}\``,
            COMMAND_EVENT_EDIT_MISSING_NAME: "Es fehlt ein Name zum aendern",
            COMMAND_EVENT_EDIT_INAVLID_NAME: "Leerzeichen im Namen sind nicht moeglich, verwende `-` oder `_` stattdessen.",
            COMMAND_EVENT_EDIT_SPACE_DATE: "Es duerfen keine Leerzeichen im Datum verwendet werden. Das korrekte Format ist `DD/MM/YYYY`",
            COMMAND_EVENT_EDIT_MISSING_DATE: "Zum aendern fehlt das Datum.",
            COMMAND_EVENT_EDIT_INVALID_DATE: "Ungueltiges Datumsformat, nur `DD/MM/YYYY` wird unterstuetzt.",
            COMMAND_EVENT_EDIT_SPACE_TIME: "Es duerfen keine Leerzeichen in der Uhrzeit verwendet werden. Das korrekte Format ist `HH:mm`",
            COMMAND_EVENT_EDIT_MISSING_TIME: "Zum aendern fehlt die Uhrzeit.",
            COMMAND_EVENT_EDIT_INVALID_TIME: "Ungueltiges Zeitformat, nur `HH:mm` wird unterstuetzt.",
            COMMAND_EVENT_EDIT_MISSING_MESSAGE: "Zum aendern fehlt die Nachricht",
            COMMAND_EVENT_EDIT_LONG_MESSAGE: "Die neue Nachricht ist zu lang. Versuche etwas zu kuerzen.",
            COMMAND_EVENT_EDIT_MISSING_CHANNEL: "Zum aendern fehlt der Kanal.",
            COMMAND_EVENT_EDIT_MISSING_COUNTDOWN: "Es fehlt die Auswahl ob der Countdown aktiviert werden soll oder nicht",
            COMMAND_EVENT_EDIT_INVALID_COUTNDOWN: "Ungueltige Option. Verwende `yes/no`, `true/false` oder `on/off`",
            COMMAND_EVENT_EDIT_MISSING_REPEATDAY: "Zum aendern fehlt etwas, repeatDay braucht bspw. etwas im Format wie `0,0,0,0,0`.",
            COMMAND_EVENT_EDIT_SPACE_REPEATDAY: "Es duerfen keine Leerzeichen verwendet werden, ein gueltiges Format ist `0,0,0,0,0`.",
            COMMAND_EVENT_EDIT_BOTH_REPEATDAY: "Es wurde bereits die Wiederholung (repeat) eingestellt und repeat & repeatDay gleichzeitig ist nicht moeglich.",
            COMMAND_EVENT_EDIT_MISSING_REPEAT: "Zum aendern fehlt etwas, repeatDay braucht bspw. etwas im Format `0d0h0m`.",
            COMMAND_EVENT_EDIT_SPACE_REPEAT: "Es duerfen keine Leerzeichen verwendet werden, ein gueltiges Format ist `0d0h0m`.",
            COMMAND_EVENT_EDIT_BOTH_REPEAT: "Es wurde bereits die Wiederholung (repeatDay) eingestellt und repeat & repeatDay gleichzeitig ist nicht moeglich.",
            COMMAND_EVENT_EDIT_UPDATED: (target, cFrom, cTo) => `${target} geaendert von **${cFrom}** nach **${cTo}**`,
            COMMAND_EVENT_EDIT_BROKE: "Etwas ist beim aktualisieren des Events fehlgeschlagen.",

            // Event Command (Help)
            COMMAND_EVENT_HELP: {
                description: "Wird verwendet um ein Event zu erstellen, zu pruefen oder zu loeschen.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Erstellt ein neues Event",
                        usage: ";event create <eventName> <eventTag> <eventZeit> [eventNachricht]",
                        args: {
                            "--repeat <WiederholZeit>": "Setzt die Dauer / ein Intervall im Format 00d00h00m. Wird nach Ablauf der Dauer in dem angegebenen Intervall wiederholt.",
                            "--repeatDay <Intervall>": ["Setzt eine Wiederholung in bestimmten Tagen im Format 0,0,0,0,0.",
                                "Beispiel: `-repeatDay 1,2,3` wiederholt das Event 1 Tag nach dem ursprünglichen Termin, dann nach 2 Tagen und nach 3 Tagen"
                            ].join("\n"),
                            "--channel <KanalName>": "Setzt einen spezifischen Kanal fuer die Ankuendigung.",
                            "--countdown": "Fuegt dem Event ein Countdown hinzu."
                        }
                    },
                    {
                        action: "Create (JSON)",
                        actionDesc: "Erstellt ein neues Event",
                        usage: ";event create --json <codeBlock mit json>",
                        args: {
                            "--json <codeBlock>": "Beispiel: ```{\n    name: '',\n    time: '',\n    day:  '',\n    message: '',\n    repeatDay: [0, 0, 0],\n    repeat: '0d0h0m',\n    countdown: false,\n    channel: ''\n}```"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Zeigt die aktuelle Liste der Events an.",
                        usage: ";event view [eventName]",
                        args: {
                            "--min": "Zeigt alle geplanten Events ohne Event-Nachricht an.",
                            "--page <Seite#>": "Waehlt eine bestimmte Seite des Eventplans aus um diese anzuzeigen."
                        }
                    },
                    {
                        action: "Delete",
                        actionDesc: "Loescht ein Event.",
                        usage: ";event delete <eventName>",
                        args: {}
                    },
                    {
                        action: "Trigger",
                        actionDesc: "Loest die Ankuendigung in dem spezifizierten Kanal aus. Das Event bleibt unverändert.",
                        usage: ";event trigger <eventName>",
                        args: {}
                    },
                    {
                        action: "Edit",
                        actionDesc: "Editiert ein vorhandenes Event",
                        usage: ";event edit <eventName> <Feld> <Aenderung>",
                        args: {
                            "eventName": "Der Name des Events das du veraendern moechtest",
                            "field": "Das Feld das du aendern willst. Waehle eines der folgenden aus:\n `name, time, date, message, channel, countdown, repeat, repeatday`.",
                            "Aenderung": "Der Wert der geaendert werden soll."
                        }
                    }
                ]
            },

            // Faction Command
            COMMAND_FACTION_MISSING_FACTION: "Fraktion fehlt",
            COMMAND_FACTION_INVALID_FACTION: "Ungueltige Fraktion",
            COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# Charakter gehoert zur Fraktion: ${searchName} # \n${charString}`,
            COMMAND_FACTION_USAGE: (prefix) => `Verwendung ist \`${prefix}faction <Fraktion>\``,
            COMMAND_FACTION_HELP: {
                description: "Zeigt die Liste der Charaktere der spezifizierten Fraktion an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "faction <Fraktion> [-leader] [-zeta]",
                        args: {
                            "faction": "Die Fraktion die du aus der Sammlung sehen moechtest.",
                            "-leader": "Beschraenkt die Ausgabe auf Charaktere mit einer Anfuehrerfaehigkeit",
                            "-zeta": "Beschraenkt die Ausgabe auf Charaktere deren Faehigkeiten mit einer Zeta aufgewertet werden koennen"
                        }
                    },
                    {
                        action: "Spieler Fraktion",
                        actionDesc: "Zeigt die Entwicklung der Fraktion eines Spieler",
                        usage: "faction <user> <Fraktion> [-leader] [-zeta]",
                        args: {
                            "user": "Zur Identifikation des Spielers (mention | allyCode | me)",
                            "Fraktion": "Die Fraktion, von der Du die Sammlung sehen willst.",
                            "-leader": "Beschraenkt die Ausgabe auf Charaktere mit einer Anfuehrerfaehigkeit",
                            "-zeta": "Beschraenkt die Ausgabe auf Charaktere deren Faehigkeiten mit einer Zeta aufgewertet werden koennen"
                        }
                    }
                ]
            },

            // Farm Command
            COMMAND_FARM_USAGE: (prefix) => `Verwendung ist \`${prefix}farm <charakter auf englisch>\``,
            COMMAND_FARM_LOCATIONS: " Farming-Gebiete",
            COMMAND_FARM_MISSING_CHARACTER: "Es fehlt die Angabe des Charakters (auf englisch)",
            COMMAND_FARM_HARD: "Hart ",
            COMMAND_FARM_LIGHT: "Helle Seite ",
            COMMAND_FARM_DARK: "Dunkle Seite ",
            COMMAND_FARM_FLEET: "Flotte ",
            COMMAND_FARM_CANTINA: "Cantina ",
            COMMAND_FARM_ENERGY_PER: " Energie pro Versuch",
            COMMAND_FARM_CHAR_UNAVAILABLE: "Wie es scheint ist dieser Charakter noch nicht oder nur ueber ein Event farmbar.",
            COMMAND_FARM_EVENT_CHARS: {
                // Heroes Journey
                "REYJEDITRAINING": "Rey's Heldenreise",
                "COMMANDERLUKESKYWALKER": "Luke Skywalker Heldenreise",
                "JEDIKNIGHTREVAN": "Legende der alten Republik",

                // Legendary events
                "CHEWBACCALEGENDARY": "Ein beruehmter Wookie",
                "R2D2_LEGENDARY": "Tapferer Droide",
                "GRANDADMIRALTHRAWN": "Kriegskuenstler",
                "C3POLEGENDARY": "Kontakt Protokoll",
                "GRANDMASTERYODA": "Grossmeister Training",
                "BB8": "Infos und Plaene",
                "EMPERORPALPATINE": "Tod des Imperators",

                // TB Rewards
                "IMPERIALPROBEDROID": "Dunkle Seite TB (Spezialmission)",
                "HOTHLEIA": "Helle Seite TB (Spezialmission)"
            },
            COMMAND_FARM_HELP: {
                description: "Zeigt eine Uebersicht von verfuegbaren Farming-Gebieten fuer Charaktere.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "farm <charakter auf englisch>",
                        args: {
                            "charakter auf englisch": "Der Charakter fuer den du die verfuegbaren Farming-Gebiete anzeigen lassen moechtest."
                        }
                    }
                ]
            },

            // Grand Arena Command
            COMMAND_GRANDARENA_INVALID_USER: (userNum) => `Ungueltiger Spieler ${userNum}`,
            COMMAND_GRANDARENA_INVALID_CHAR: (char) => `Keine Ergebnisse gefunden fuer "${char}"`,
            COMMAND_GRANDARENA_COMP_NAMES: {
                charGP: "Char GM",
                shipGP: "Schiff GM",
                cArena: "C Arena",
                sArena: "S Arena",
                zetas: "Zetas",
                star6: "6 Sterne",
                star7: "7 Sterne",
                g11: "Gear 11",
                g12: "Gear 12",
                g13: "Gear 13",
                "mods6": "6*  Mods",
                "spd10": "10+  Tempo",
                "spd15": "15+  Tempo",
                "spd20": "20+  Tempo",
                "off100": "100+ Ang",
                "level": "Level",
                "gearLvl": "Gear Lvl",
                "starLvl": "Stern Lvl",
                "speed": "Tempo"
            },
            COMMAND_GRANDARENA_EXTRAS_HEADER:"Extras",
            COMMAND_GRANDARENA_EXTRAS: (extraCount) => `Es gibt ${extraCount} Charaktere mehr die deiner Suche entsprechen aber nicht angezeigt werden koennen.`,
            COMMAND_GRANDARENA_OUT_HEADER: (p1, p2) => `Grosse Arena ${p1} vs ${p2}`,
            COMMAND_GRANDARENA_OUT_DESC: (overview, modOverview) => `**Statistik:**${overview}**Mod Statistik:**${modOverview}`,
            COMMAND_GRANDARENA_HELP: {
                description: "Vergleicht 2 Spieler fuer die Grosse Arena.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";grandarena <user1> <user2> [-faction Fraktion] [character1] | [character2] | ...",
                        args: {
                            "users": "Zur Identifikation des Spielers (mention | allyCode | me)",
                            "characters": "Eine Liste von Charakteren (getrennt durch das | Symbol).",
                            "-faction": "Eine Fraktion die angezeigt werden soll."
                        }
                    }
                ]
            },

            // Guilds Command
            COMMAND_GUILDS_MORE_INFO: "Fuer mehr Info zu einer spezifischen Gilde:",
            COMMAND_GUILDS_NO_GUILD: "Ich kann diese Gilde nicht finden.",
            COMMAND_GUILDS_PLEASE_WAIT: "Bitte warten waehrend ich die Info zu deiner Gilde aktualisiere",
            COMMAND_GUILDS_USERS_IN_GUILD: (users, guild) => `${users} Spieler bei ${guild}`,
            COMMAND_GUILDS_GUILD_GP_HEADER: "Registrierte GM",
            COMMAND_GUILDS_GUILD_GP: (total, average) => `Gesamt GM: ${total}\nDurchschnitt : ${average}`,
            COMMAND_GUILDS_DESC: "Gildenbeschreibung",
            COMMAND_GUILDS_MSG: "Chat Ankuendigung",
            COMMAND_GUILDS_REG_NEEDED: "Ich kann keine Gilde fuer diesen User finden. Bitte sicherstellen dass der Buendniscode korrekt ist.",
            COMMAND_GUILDS_ROSTER_HEADER: (ix, len) => `Roster (${ix}/${len})`,
            COMMAND_GUILDS_RAID_STRINGS: {
                header:    "Raids",
                rancor:    "Rancor: ",
                aat:       "AAT:    ",
                sith_raid: "Sith:   ",
                heroic:    "Heroisch"
            },
            COMMAND_GUILDS_STAT_HEADER: "Statistiken",
            COMMAND_GUILDS_STAT_STRINGS: (members, lvl, gp, charGP, shipGP) => [
                `Mitglieder:      ${members}/50`,
                `Erforderliches Lvl: ${lvl}`,
                `Ca. Char GM: ${charGP}`,
                `Ca. Schiff GM: ${shipGP}`,
                `Gesamt GM:     ${gp}`
            ].join("\n"),
            COMMAND_GUILDS_FOOTER: "`/guilds roster` eine Liste der Gildenmitglieder und ihrer GM.\n`/guilds roster allycoda <allycode>` fuer eine Liste mit ihren Buendniscodes. ",
            COMMAND_GUILDS_TWS_HEADER: (guildName) => `${guildName} Territorialkrieg Uebersicht`,
            COMMAND_GUILDS_HELP: {
                description: "Zeigt dir jeden in deiner Gilde und grundsätzliche Statistiken an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guild [user]\n;guild [user] [-roster] [-sort] [-reg]\n;guild [user] [-roster] [-allycode] [-reg]",
                        args: {
                            "user": "Zur Identifizierung der Gilde. (mention | allyCode | guildName)",
                            "-roster": "Zeigt eine Liste aller Gildenmitglieder dieser Gilde an",
                            "-allycode": "Zeigt den Buendniscode anstatt die GM eines Gieldenmitglieds an",
                            "-sort": "Waehle zwischen einer Sortierung nach Namen oder GM",
                            "-reg": "Zeigt den Discordnamen neben dem registrierten Namen des Users auf dem Server an."
                        }
                    },
                    {
                        action: "Territorialkrieg Uebersicht",
                        actionDesc: "Zeigt eine allgemeine Uebersicht von wichtigen Charakteren einer spezifizierten Gilde an",
                        usage: ";guild [user] -twsummary",
                        args: {
                            "user": "Zur Identifikation der Gilde (mention | allyCode | guildName)",
                            "-twsummary": "Zeigt die Uebersicht an  (-tw)"
                        }
                    }
                ]
            },

            // GuildSearch Command
            COMMAND_GUILDSEARCH_SHIP_STATS: "Entschuldige, aber ich kann im Moment keine Statistiken zu diesem Schiff abrufen.",
            COMMAND_GUILDSEARCH_CONFLICTING: (args) => `Du verwendest Parameter die untereinander nicht kompatibel sind. Folgende koennen nicht gleichzeitig verwendet werden. ${args}`,
            COMMAND_GUILDSEARCH_GEAR_SUM: "Char Ausruestung Uebersicht",
            COMMAND_GUILDSEARCH_CHAR_STAR_SUM: "Char Stern Lvl Uebersicht",
            COMMAND_GUILDSEARCH_SHIP_STAR_SUM: "Schiff Stern Lvl Uebersicht",
            COMMAND_GUILDSEARCH_INVALID_SORT: (opts) => `Ungueltige Sortierung. Verwende: \`${opts}\``,
            COMMAND_GUILDSEARCH_BAD_STAR: "Du kannst nur ein Sternen-Level von 1-7 waehlen",
            COMMAND_GUILDSEARCH_BAD_SORT: (sortType, filters) => `Entschuldigung, aber \`${sortType}\` ist keine gueltige Sortierreihenfolge. Nur \`${filters.join(", ")}\` ist moeglich.`,
            COMMAND_GUILDSEARCH_MISSING_CHAR: "Du musst einen Charakter angeben",
            COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `Ich habe keine Ergebnisse gefunden fuer ${character}`,
            COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `Deine Suche hat zu viele Treffer ergeben. Bitte spezifizieren. \nHier ist eine Liste mit den besten Treffern.\n\`\`\`${chars}\`\`\``,
            COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `Niemand in deiner Gilde scheint diesen Charakter auf ${starLvl} Sterne zu haben.`,
            COMMAND_GUILDSEARCH_NO_CHAR: "Niemand in deiner Gilde scheint diesen Charakter zu haben.",
            COMMAND_GUILDSEARCH_NOT_ACTIVATED: (count) => `Nicht aktiviert (${count})`,
            COMMAND_GUILDSEARCH_STAR_HEADER: (star, count) => `${star} Sterne (${count})`,
            COMMAND_GUILDSEARCH_PLEASE_WAIT: "Bitte warten waehrend ich die Sammlung deiner Gilde durchsuche.",
            COMMAND_GUILDSEARCH_NO_CHARACTER: "Wie es scheint hat niemand in der Gilde diesen Charakter freigeschaltet.",
            COMMAND_GUILDSEARCH_NO_SHIP: "Wie es scheint hat niemand in der Gilde dieses Schiff freigeschaltet.",
            COMMAND_GUILDSEARCH_NO_CHARACTER_STAR: (star) => `Wie es scheint hat niemand in der Gilde diesen Charakter auf dem Sternlevel ${star}* oder hoeher freigeschaltet.`,
            COMMAND_GUILDSEARCH_NO_SHIP_STAR: (star) => `Wie es scheint hat niemand in der Gilde dieses Schiff auf dem Sternlevel ${star}* oder hoeher freigeschaltet. `,
            COMMAND_GUILDSEARCH_NO_ZETAS: "Wie es scheint hat niemand in der Gilde diesem Charakter ein Zeta gegeben.",
            COMMAND_GUILDSEARCH_SORTED_BY: (char, sort) => `${char} (sortiert nach ${sort})`,
            COMMAND_GUILDSEARCH_MODS_HEADER: (guildName) => `${guildName}'s mods'`,
            COMMAND_GUILDSEARCH_HELP: {
                description: "Zeigt den Stern-Level des gewaehlten Charakters von allen Gildenmitgliedern an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guildsearch [user] <character> [-zetas] [-ships] [-reverse] [-sort type] [starLvl]",
                        args: {
                            "user": "Die Person dessen Gilde du pruefen moechtest (me | userID | mention)",
                            "character": "Der Charakter nach dem du suchen moechtest.",
                            "-ships": "Suche nach Schiffen, benutze `-s, -ship, oder -ships`",
                            "-reverse": "Kehrt die Sortierreihenfolge um",
                            "-sort": "Waehle entweder eine Sortierung nach Name, Ausruestung oder GM",
                            "-top X": "Zeigt die Top X Ergebnisse an (X ist zwischen 0 und 50)",
                            "-zetas": "Zeigt nur Charaktere die Zetas haben",
                            "starLvl": "Waehle den Star-Level aus den du sehen moechtest."
                        }
                    },
                    {
                        action: "Vergleich der Werte",
                        actionDesc: "Vergleicht die Werte eines Charakters innerhalb einer Gilde",
                        usage: ";guildsearch [user] <charaktername auf englisch> -stats <stat>",
                        args: {
                            "user": "Der Spieler dessen Gilde du pruefen moechtest. (me | userID | mention)",
                            "character": "Der Charakter nach dem du suchen moechtest (auf englisch).",
                            "stat": "Einer dieser Statistik-Werte eines Charakters ```Health, Protection, Speed, Potency, PhysicalCriticalChance, SpecialCriticalChance, CriticalDamage, Tenacity, Accuracy, Armor, Resistance```"
                        }
                    },
                    {
                        action: "Mods Uebersicht",
                        actionDesc: "Vergleiche die wichtigsten Mods innerhalb deiner Gilde",
                        usage: ";guildsearch [user] -mods",
                        args: {
                            "user": "Der Spieler dessen Gilde du sehen moechtest (me | userID | mention)",
                            "-mods": "Angabe um die Mods zu sehen. (-m | -mod)",
                            "-sort": "Sortiert nach speed, offense, oder 6 (fuer 6* mods)"
                        }
                    },
                    {
                        action: "Ausruestung Uebersicht",
                        actionDesc: "Vergleicht die Anzahl von hoeheren Ausruestungsstufen innerhalb der Gilde",
                        usage: ";guildsearch [user] -gear [-sort gearLvl]",
                        args: {
                            "user": "Spieler dessen Gilde du sehen moechtest. (me | userID | mention)",
                            "-gear": "Zur Anzeige der Ausruestungsstufen (-g)",
                            "-sort": "Waehle die Ausruestungsstufe nach der sortiert werden soll (9,10,11,12)"
                        }
                    },
                    {
                        action: "Charakter Stern Uebersicht",
                        actionDesc: "Vergleicht die Anzahl von hoeheren Stern-Level innerhalb der Gilde",
                        usage: ";guildsearch [user] -stars [-sort starLvl] [-ship]",
                        args: {
                            "user": "Spieler dessen Gilde du sehen moechtest. (me | userID | mention)",
                            "-stars": "Zur Anzeige des Stern-Level (-star | -*)",
                            "-sort": "Waehle den Stern-Level nach dem sortiert werden soll (10,11,12)",
                            "-ship": "Zeigt die Schiffe anstatt die Charaktere an (-s | -ship | -ships)"
                        }
                    },
                ]
            },

            // Help Command
            COMMAND_HELP_HEADER: (prefix) => `= Kommandoliste =\n\n[Benutze ${prefix}Help <Kommandoname> fuer Details]\n`,
            COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\n Befehl:: ${prefix}${command.help.usage}`,
            COMMAND_HELP_HELP: {
                description: "Zeigt die verfuegbaren Kommandos an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";help [Kommando]",
                        args: {
                            "Kommando": "Das Kommando, zu dem Du die Hilfe aufrufen willst."
                        }
                    }
                ]
            },

            // Info Command
            COMMAND_INFO_OUTPUT: {
                "header"      : "== Bot Information ==",
                "statHeader"  : "== Bot Statistiken ==",
                "prefix"      : "Praefix",
                "users"       : "Users",
                "servers"     : "Servers",
                "discordVer"  : "Discord.js",
                "nodeVer"     : "Node",
                "swgohHeader" : "== SWGoH Statistiken ==",
                "players"     : "Spieler",
                "guilds"      : "Gilden",
                "lang"        : "Sprachen",
                "links": {
                    "Fuege mich deinem Server hinzu": "- http://swgohbot.com/invite",
                    "Teilnahme SWGoHBot HQ": "- https://discord.gg/FfwGvhr",
                    "Unterstuetze den Bot": "- [Github](https://github.com/jmiln/SWGoHBot)\n- [Patreon](https://www.patreon.com/swgohbot)\n- [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YY3B9BS298KYW)"
                }
            },
            COMMAND_INFO_HELP: {
                description: "Zeigt nuetzliche Links zum Bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "info",
                        args: {}
                    }
                ]
            },

            COMMAND_MODS_CRIT_CHANCE_SET: "Krit. Chance x2",
            COMMAND_MODS_CRIT_DAMAGE_SET: "Krit. Schaden x4",
            COMMAND_MODS_SPEED_SET: "Tempo x4",
            COMMAND_MODS_TENACITY_SET: "Zaehigkeit x2",
            COMMAND_MODS_OFFENSE_SET: "Angriff x4",
            COMMAND_MODS_POTENCY_SET: "Effektivitaet x2",
            COMMAND_MODS_HEALTH_SET: "Gesundheit x2",
            COMMAND_MODS_DEFENSE_SET: "Abwehr x2",
            COMMAND_MODS_EMPTY_SET: " ",

            COMMAND_MODS_ACCURACY_STAT: "Praezision",
            COMMAND_MODS_CRIT_CHANCE_STAT: "Krit. Chance",
            COMMAND_MODS_CRIT_DAMAGE_STAT: "Krit. Schaden",
            COMMAND_MODS_DEFENSE_STAT: "Abwehr",
            COMMAND_MODS_HEALTH_STAT: "Gesundheit",
            COMMAND_MODS_OFFENSE_STAT: "Angriff",
            COMMAND_MODS_PROTECTION_STAT: "Schutz",
            COMMAND_MODS_POTENCY_STAT: "Effektivitaet",
            COMMAND_MODS_SPEED_STAT: "Tempo",
            COMMAND_MODS_TENACITY_STAT: "Zaehigkeit",
            COMMAND_MODS_UNKNOWN: "Unbekannt",

            // Mods Command
            COMMAND_MODS_NEED_CHARACTER: (prefix) => `Benoetigt einen Charakter. Der Befehl lautet: \`${prefix}mods <Charaktername auf englisch>\``,
            COMMAND_MODS_INVALID_CHARACTER_HEADER: "Ungueltiger Charakter",
            COMMAND_MODS_USAGE: "Verwendung ist `/mods character <CharakterName auf englisch>`",
            COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) =>  `\`Quadrat:   ${square}\`\n\`Pfeil:     ${arrow}\`\n\`Diamant:   ${diamond}\`\n`,
            COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Dreieck:   ${triangle}\`\n\`Kreis:     ${circle}\`\n\`Kreuz:     ${cross}\``,
            COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### Sets ###**\n${modSetString}\n**### Primaer ###**\n${modPrimaryString}`,
            COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) => `* Quadrat:   ${square}  \n* Pfeil:    ${arrow} \n* Diamant:  ${diamond}\n`,
            COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Dreieck: ${triangle}\n* Kreis:   ${circle}\n* Kreuz:    ${cross}`,
            COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### Sets ### \n${modSetString}\n### Primaer ###\n${modPrimaryString}`,
            COMMAND_NO_MODSETS: "Keine Mod Sets fuer diesen Charakter verfuegbar",
            COMMAND_MODS_HELP: {
                description: "Zeigt empfohlene Mods für den Charakter an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mods <Charaktername auf englisch>",
                        args: {
                            "Charakter": "Der Charakter fuer den Du Mods anzeigen willst"
                        }
                    }
                ]
            },

            // Modsets command
            COMMAND_MODSETS_OUTPUT: "* Kritischer Treffer Chance:  2\n* Kritischer Schaden:  4\n* Abwehr:  2\n* Gesundheit:   2\n* Angriff:  4\n* Effektivität:  2\n* Tempo:    4\n* Zaehigkeit: 2",
            COMMAND_MODSETS_HELP: {
                description: "Zeigt an, wieviele Mods fuer ein Set benoetigt werden.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";modsets",
                        args: {}
                    }
                ]
            },

            // MyArena Command
            COMMAND_MYARENA_NO_USER: (user) => `Entschuldigung, aber ich kann keine Arena Informationen finden für den Spieler ${user}. Bitte sicherstellen, dass der Account synchronisiert ist.`,
            COMMAND_MYARENA_NO_CHAR: "Etwas ist schief gegangen, ich konnte deine Charaktere nicht holen.",
            COMMAND_MYARENA_ARENA: (rank) => `Char Arena (Rang: ${rank})`,
            COMMAND_MYARENA_FLEET: (rank) => `Flotten Arena (Rang: ${rank})`,
            COMMAND_MYARENA_EMBED_HEADER: (playerName) => `${playerName}'s Arena`,
            COMMAND_MYARENA_EMBED_FOOTER: (date) => `Arena Daten sind vom: ${date}`,
            COMMAND_MYARENA_HELP: {
                description: "Zeigt den gegenwaertigen Rang der Arena und das aktuelle Team eines Spielers an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myarena [user]",
                        args: {
                            "user": "Spieler den du sehen willst. (me | userID | mention)"
                        }
                    }
                ]
            },

            // MyCharacter Command
            COMMAND_MYCHARACTER_ABILITIES: "Faehigkeiten",
            COMMAND_MYCHARACTER_HELP: ({
                description: "Zeigt die Werte eines ausgewaehlten Charakters an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mycharacter [user] <character>",
                        args: {
                            "user": "Das Discordprofil des jeweiligen Spielers. (me | userID | mention)",
                            "character": "Der Charakter nach dem du suchen moechtest.",
                            "-s": "Sucht nach dem Schiff des Piloten"
                        }
                    }
                ]
            }),

            // MyMods Command
            COMMAND_MYMODS_NO_MODS: (charName) => `Entschuldigung, aber ich konnte keine Mods finden für dein ${charName}`,
            COMMAND_MYMODS_MISSING_MODS: "Entschuldigung, aber ich kann aktuell keine Mods finden. Bitte warte etwas und versuche es erneut.",
            COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `Mods zuletzt aktualisiert: ${lastUpdated}`,
            COMMAND_MYMODS_WAIT: "Bitte warten waehrend ich deine Sammlung durchsuche.",
            COMMAND_MYMODS_BAD_STAT: (stats) => `Entschuldige, aber ich kann nur nach folgenden Werten sortieren: ${stats}`,
            COMMAND_MYMODS_HEADER_TOTAL: (name, stat) => `${name}'s Beste ${stat} aus Mods`,
            COMMAND_MYMODS_HEADER_MODS: (name, stat) => `${name}'s Hoechste ${stat} Charaktere`,
            COMMAND_MYMODS_HELP: ({
                description: "Zeigt die ausgestatteten Mods eines bestimmten Charakters an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mymods [user] <character>",
                        args: {
                            "user": "Das Discordprofil des jeweiligen Spielers. (me | userID | mention)",
                            "character": "Der Charakter nach dem du suchst."
                        }
                    },
                    {
                        action: "Beste Werte",
                        actionDesc: "Zeigt deine Top 10 Charaktere fuer den jeweiligen Wert an",
                        usage: ";mymods -best <filter>\n;mymods -total -best <filter>",
                        args: {
                            "-best": "Zeigt die besten Werte an (-b)",
                            "-total": "Sortiert nach Gesamtwert anstatt nach mod boost (-t)",
                            "filter": "Einer der Charakterwerte die du sehen moechtest"
                        }
                    }
                ]
            }),

            // MyProfile Command
            COMMAND_MYPROFILE_NO_USER: (user) => `Entschuldigung, aber ich kann keine Arena Informationen finden fuer ${user}. Bitte sicherstellen dass der Account synchronisiert ist`,
            COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `${playerName}'s Profil (${allyCode})`,
            COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `Arenadaten vom: ${date}`,
            COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank, gpFull) => `**Gilde:** ${guildName}\n**Level:** ${level}\n**Arena Rang:** ${charRank}\n**Flotten Rang:** ${shipRank}\n**Gesamt GM:** ${gpFull}`,
            COMMAND_MYPROFILE_MODS: (mods) => ({
                header: "Mod Uebersicht",
                modStrs: [
                    `6* Mods  :: ${mods.sixPip}`,
                    `Spd 15+  :: ${mods.spd15}`,
                    `Spd 20+  :: ${mods.spd20}`,
                    `Off 100+ :: ${mods.off100}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount) => ({
                header: `Charaktere (${charList.length})`,
                stats: [
                    `Char GM  :: ${gpChar}`,
                    `7 Sterne   :: ${charList.filter(c => c.rarity === 7).length}`,
                    `lvl 85   :: ${charList.filter(c => c.level === 85).length}`,
                    `Ausruestungsstufe 12  :: ${charList.filter(c => c.gear === 12).length}`,
                    `Ausruestungsstufe 11  :: ${charList.filter(c => c.gear === 11).length}`,
                    `Zetas    :: ${zetaCount}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
                header: `Flotten (${shipList.length})`,
                stats: [
                    `Flotten GM :: ${gpShip}`,
                    `7 Sterne  :: ${shipList.filter(s => s.rarity === 7).length}`,
                    `lvl 85  :: ${shipList.filter(s => s.level === 85).length}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_HELP: {
                description: "Zeigt allgemeine Werte eines Spielers.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myprofile [user]",
                        args: {
                            "user": "Die Person die du sehen moechtest. (me | userID | mention)"
                        }
                    }
                ]
            },

            // Need Command
            COMMAND_NEED_MISSING_USER: "Wenn du diesen Befehl verwenden moechtest, musst du dich entweder registrieren oder einen Buendniscode angeben.",
            COMMAND_NEED_MISSING_SEARCH: (search) => `Es konnte nichts gefunden werden fuer ${search}`,
            COMMAND_NEED_CHAR_HEADER: "__Charaktere:__",
            COMMAND_NEED_SHIP_HEADER: "__Schiffe:__",
            COMMAND_NEED_COMPLETE: "Glueckwunsch, du hast alles von hier!",
            COMMAND_NEED_ALL_CHAR: "Glueckwunsch, du hast alle Charaktere auf 7*",
            COMMAND_NEED_ALL_SHIP: "Glueckwunsch, du hast alle Schiffe auf 7*",
            COMMAND_NEED_PARTIAL: (percent) => `Du bist zu **${percent}%** fertig.`,
            COMMAND_NEED_HEADER: (player, search) => `${player}'s ${search} benoetigt`,
            COMMAND_NEED_HELP: {
                description: "Zeigt Deinen Fortschritt zu den 7* Charakteren einer Fraktion oder eines Shops an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";need [user] <fraktion|shop|battle|keyword>",
                        args: {
                            "user": "Der Spieler den du sehen moechtest. (me | userID | mention)",
                            "fraktion | shop": "Die Fraktion oder den Shop dessen Fortschritt du sehen moechtest",
                            "keyword": "Eines der folgenden Stichwoerter (siehe unten)"
                        }
                    },
                    {
                        action: "Shops",
                        actionDesc: "",
                        args: {
                            "arena":   "Arena shop",
                            "cantina": "Cantina shop",
                            "fleet":   "Fleet shop",
                            "guild":   "Gilden shop",
                            "gw":      "Galaktischer Krieg shop",
                            "shard":   "Splitter shop"
                        }
                    },
                    {
                        action: "Battles",
                        actionDesc: "",
                        args: {
                            "Helle Kaempfe":   "Helle Seite harte Kaempfe",
                            "Dunkle Kaempfe":    "Dunkle Seite harte Kaempfe",
                            "Cantina Kaempfe": "Cantina Kaempfe",
                            "Flotten Kaempfe":   "Flotten Kaempfe"
                        }
                    },
                    {
                        action: "Keywords",
                        actionDesc: "",
                        args: {
                            "battles": "Zeigt fehlende Charaktere von den verschiedenen Knoten an",
                            "shops":   "Zeigt an was alles aus den jeweiligen Stores fehlt.",
                            "*":       "Zeigt alles an was fehlt."
                        }
                    }
                ]
            },

            // Nickname Command
            COMMAND_NICKNAME_SUCCESS: "Ich habe meinen nickname geaendert.",
            COMMAND_NICKNAME_FAILURE: "Entschuldige, aber ich habe keine Berechtigung das zu aendern.",
            COMMAND_NICKNAME_TOO_LONG: "Ein Name kann maximal 32 Zeichen lang sein.",
            COMMAND_NICKNAME_HELP: {
                description: "Aendert den Botnamen auf dem Server.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";nickname <Name>",
                        args: {
                            "Name": "Der Name zu dem Du den Botnamen aendern moechtest. Keinen Namen angeben um den Namen auf den Standardwert zurueckzusetzen."
                        }
                    }
                ]
            },

            // Polls Command
            COMMAND_POLL_NO_ARG: "Es muss eine waehlbare Option oder eine Aktion angegeben werden (create/view/etc).",
            COMMAND_POLL_TITLE_TOO_LONG: "Entschuldigung, aber der Titel/die Frage darf maximal 255 Zeichen lang sein.",
            COMMAND_POLL_ALREADY_RUNNING: "Entschuldigung, aber es kann nur eine Umfrage zur gleichen Zeit durchgefuehrt werden. Bitte beende zuerst die aktuelle Umfrage.",
            COMMAND_POLL_MISSING_QUESTION: "Es muss etwas angeben werden über das abgestimmt werden soll.",
            COMMAND_POLL_TOO_FEW_OPT: "Es muessen mindestens 2 Optionen zur Wahl gestellt werden.",
            COMMAND_POLL_TOO_MANY_OPT: "Es koennen max. bis zu 10 Optionen zur Wahl gestellt werden.",
            COMMAND_POLL_CREATED: (name, prefix) => `**${name}** hat eine neue Umfrage gestartet:\nVote mit \`${prefix}poll <Nr>\`\n`,
            COMMAND_POLL_NO_POLL: "Es wird aktuell keine Umfrage durchgefuehrt",
            COMMAND_POLL_FINAL: (poll) => `Endergebnisse fuer ${poll}`,
            COMMAND_POLL_FINAL_ERROR: (question) => `Loeschen fehlgeschlagen **${question}**, bitte erneut versuchen.`,
            COMMAND_POLL_INVALID_OPTION: "Das ist keine gueltige Option.",
            COMMAND_POLL_SAME_OPT: (opt) => `Du hast bereits gewaehlt **${opt}**`,
            COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `Die Auswahl wurde geaendert von **${oldOpt}** zu **${newOpt}**`,
            COMMAND_POLL_REGISTERED: (opt) => `Wahl fuer **${opt}** gespeichert`,
            COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice} **${optCount} vote${optCount === 1 ? "" : "s"}**\n`,
            COMMAND_POLL_FOOTER: (id, prefix) => `Poll id: ${id}  -  \`${prefix}poll <Nr>\` zum voten`,
            // Remote poll strings
            COMMAND_POLL_INVALID_ID: "Eine Umfrage mit dieser ID existiert nicht.",
            COMMAND_POLL_NO_ACCESS: "Entschuldige, aber du hast keinen Zugriff auf diese Umfrage.",
            COMMAND_POLL_REMOTE_OPTS: "Die einzigen gueltigen Aktionen fuer remote Umfragen sind voting oder eine Umfrage pruefen.",
            COMMAND_POLL_DM_USE: (prefix) => `Entschuldige, aber wenn du diesen Befehl in einer PN nutzen moechtest, musst du eine Umfrage ID wie folgt angeben. \`${prefix}poll -poll <UmfrageID>\``,
            COMMAND_POLL_DM_FOOTER: (id, prefix) => `Umfrage ID: ${id}  -  \`${prefix}poll <choice> -poll ${id}\`  zum voten`,
            COMMAND_POLL_ME1: (pollID, poll) => `Hier sind die gueltigen Optionen fuer die Umfrage ${pollID}\n${poll}\nKopiere die unten stehende Nachricht und aendere \`<Auswahl>\` auf die Option die du waehlen moechtest`,
            COMMAND_POLL_ME2: (prefix, pollID) => `${prefix}poll -poll ${pollID} <Auswahl>`,
            COMMAND_POLL_HELP: {
                description: "Startet deine Umfrage mit mehreren Optionen.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Erstelle eine neue Umfrage",
                        usage: ";poll create [-anonymous] <Frage> | <Opt1> | <Opt2> | [...] | [Opt10]",
                        args: {
                            "Frage": "Deine Frage, zu der du Feedback erwartest.",
                            "Opt": "Die Optionen, von denen die Teilnehmer auswaehlen koennen",
                            "-anonymous": "Wenn diese Option eingefuegt wird, dann werden die Abstimmungsergebnisse nicht angezeigt bis die Umfrage beendet wird. (-anon)"
                        }
                    },
                    {
                        action: "Vote",
                        actionDesc: "Waehle deine Option aus",
                        usage: ";poll <Nr>",
                        args: {
                            "Nr": "Die Option die du waehlst."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Sieh dir die aktuellen Ergebnisse und Optionen fuer die Umfrage in diesem Kanal an.",
                        usage: ";poll view",
                        args: {}
                    },
                    {
                        action: "Close",
                        actionDesc: "Beende die Umfrage in diesem Kanal und zeige das engueltige Ergebnis an.",
                        usage: ";poll close",
                        args: {}
                    },
                    {
                        action: "Remote View/ Vote",
                        actionDesc: "Stimme ab oder sieh dir den Status zu einer Umfrage an die mit einem bestimmten Kanal verknuepft ist.",
                        usage: ";poll view -poll <Umfrage> \n;poll vote <Nr> -poll <Umfrage>\n;poll me",
                        args: {
                            "pollID": "Die ID der Umfrage die du sehen oder verwenden moechtest",
                            "Nr": "Die Auswahl die du treffen moechtest.",
                            "me": "Sendet dir die zur Verfuegung stehenden Optionen die du auswaehlen kannst und ein Beispiel welches du kopieren / fuer das du abstimmen kannst"
                        }
                    }
                ]
            },

            // RaidDamage Command
            COMMAND_RAIDDAMAGE_DMG: "Schaden",
            COMMAND_RAIDDAMAGE_MISSING_RAID: "Raid fehlt",
            COMMAND_RAIDDAMAGE_INVALID_RAID: "Ungueltiger Raid",
            COMMAND_RAIDDAMAGE_RAID_STR: (raids) => `Bitte waehle einen der folgenden raids:\n\`${raids}\``,
            COMMAND_RAIDDAMAGE_MISSING_PHASE: "Phase fehlt",
            COMMAND_RAIDDAMAGE_INVALID_PHASE: "Ungueltige Phase",
            COMMAND_RAIDDAMAGE_PHASE_STR: (raid, phases) => `Bitte waehle eine der folgenden Phasen aus fuer ${raid} raid:\n${phases}`,
            COMMAND_RAIDDAMAGE_MISSING_AMT: "Fehlende Schadenshoehe",
            COMMAND_RAIDDAMAGE_INVALID_AMT: "Ungueltige Schadenshoehe",
            COMMAND_RAIDDAMAGE_AMOUNT_STR: "Du musst entweder eine Schadenshoehe oder einen prozentualen Wert angeben der umgerechnet werden soll",
            COMMAND_RAIDDAMAGE_OUT_HEADER: (raidName, phaseName) => `${raidName} raid, ${phaseName}`,
            COMMAND_RAIDDAMAGE_OUT_DMG: (inAmt, outAmt) => `**${inAmt} ist etwa ${outAmt} des Boss-Gegners' hp**`,
            COMMAND_RAIDDAMAGE_OUT_PERCENT: (inAmt, outAmt) => `**${inAmt} ist etwa ${outAmt}**`,
            COMMAND_RAIDDAMAGE_OUT_STR: (inAmt, outAmt, phase, raid) => `${inAmt} ist etwa ${outAmt} waehrend ${phase} vom ${raid} raid.`,
            COMMAND_RAIDDAMAGE_HELP: {
                description: "Rechnet die Schadenshoehe bzw den prozentualen Wert um",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";raiddamage <raid> <phase> <damage>",
                        args: {
                            "raid": "Der Raid den du sehen moechtest. (aat|pit|sith)",
                            "phase": "Die Phase des Raids die du sehen moechtest. (p1|p2|p3|p4|solo)",
                            "damage": "Die Schadenshoehe die du sehen moechtest. (Bspw: 40000 oder 35%)"
                        }
                    }
                ]
            },

            // Randomchar Command
            COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `Entschuldige, aber du brauchst eine Nummer 1-${maxChar} hier.`,
            COMMAND_RANDOMCHAR_HELP: {
                description: "Nimmt 5 zufaellige Charaktere und erstellt ein Team.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";randomchar [user][AnzahlCharaktere]",
                        args: {
                            "user": "Die Charaktersammlung eines Spielers aus der ausgewaehlt werden soll. (me | userID | mention)",
                            "AnzahlCharaktere": "Die Anzahl der Charaktere, die ausgewaehlt werden sollen",
                            "-star X": "Waehle den Mindest-Stern-Level (X) fuer den Charakter der ausgesucht werden soll."
                        }
                    }
                ]
            },

            // Register Command
            COMMAND_REGISTER_MISSING_ALLY: "Du musst einen Buendniscode angeben mit dem du das Konto verknuepfen willst.",
            COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `Entschuldigung, aber ${allyCode} ist kein gueltiger Buendniscode`,
            COMMAND_REGISTER_ALREADY_REGISTERED: "Das ist bereits dein registrierter Buendniscode!",
            COMMAND_REGISTER_ADD_NO_SERVER: "Du kannst nur User angeben die bereits auf diesem Server sind.",
            COMMAND_REGISTER_PLEASE_WAIT: "Bitte warten waehrend ich die Daten synchronisiere.",
            COMMAND_REGISTER_FAILURE: "Registrierung fehlgeschlagen, bitte sicherstellen dass der Buendniscode korrekt ist.",
            COMMAND_REGISTER_SUCCESS_HEADER: (user) => `Registrierung fuer ${user} erfolgreich!`,
            COMMAND_REGISTER_SUCCESS_DESC: (user, allyCode, gp) => [
                `Buendniscode :: ${allyCode}`,
                `Gilde    :: ${user.guildName || "N/A"}`,
                `GM       :: ${gp}`,
                `Level    :: ${user.level}`
            ].join("\n"),
            COMMAND_REGISTER_HELP: {
                description: "Verknuepft den Buendniscode mit der Discord-ID und synchronisiert das SWGoH Profil.",
                actions: [
                    {
                        action: "",
                        actionDesc: "Verknuepft das Discord Profil zu einem SWGoH account",
                        usage: ";register [user] <Buendniscode>",
                        args: {
                            "user": "Der Spieler den du hinzufuegen moechtest. (userID | mention)",
                            "Buendniscode": "Der In-Game Buendniscode."
                        }
                    }
                ]
            },



            // Reload Command
            COMMAND_RELOAD_INVALID_CMD: (cmd) => `Ich kann das Kommando nicht finden: ${cmd}`,
            COMMAND_RELOAD_SUCCESS: (cmd) => `Erfolgreich neu geladen: ${cmd}`,
            COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `Neuladen des Kommandos fehlgeschlagen: ${cmd}\n\`\`\`${stackTrace}\`\`\``,
            COMMAND_RELOAD_HELP: {
                description: "Laedt die Kommandodatei neu, wenn sie aktualisiert oder geändert wurde.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";reload <Kommando>",
                        args: {
                            "Kommando": "Das Kommando, welches neu geladen werden soll."
                        }
                    }
                ]
            },

            // Reload Data Command
            COMMAND_RELOADDATA_HELP: {
                description: "Laedt die selektierte(n) Datei(en) neu.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";reloaddata <option>",
                        args: {
                            "option": "Was du neuladen moechtest ( Kommando | Daten | Events | Funktion )."
                        }
                    }
                ]
            },

            // Resources Command
            COMMAND_RESOURCES_HEADER: "SWGoH Quellen",
            COMMAND_RESOURCES_INVALID_CATEGORY: (list) => `Ungueltige Kategorie. Bitte waehle eine der folgenden aus: \`${list}\``,
            COMMAND_RESOURCES_HELP: {
                description: "Zeigt nuetzliche SWGoH-Quellen an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";resources <Kategorie>",
                        args: {
                            "Kategorie": "Eine der verfuegbaren Kategorien (Bots, Game Changers, Websites)."
                        }
                    }
                ]
            },

            // Setconf Command
            COMMAND_SETCONF_MISSING_PERMS: "Entschuldige, aber entweder bist du kein Admin oder der Anfuehrer dieses Servers hat die Konfiguration nicht eingestellt.",
            COMMAND_SETCONF_MISSING_OPTION: "Du musst eine Konfig-Option auswaehlen zum aendern.",
            COMMAND_SETCONF_MISSING_VALUE: "Zum aendern dieser Option musst du einen Wert angeben.",
            COMMAND_SETCONF_ARRAY_MISSING_OPT: "Du musst `add` oder `remove` verwenden.",
            COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `Entschuldige, aber \`${value}\` ist nicht gesetzt in \`${key}\`.`,
            COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${value}\` wurde ${action} dein \`${key}\`.`,
            COMMAND_SETCONF_NO_KEY: (prefix) => `Dieser Wert ist nicht in der Konfiguration. Siehe "${prefix}showconf", oder "${prefix}setconf help" fuer eine Liste`,
            COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `Gildenkonfiguration fuer ${key} wurde geaendert in:\n\`${value}\``,
            COMMAND_SETCONF_NO_SETTINGS: "Keine Gildeneinstellungen gefunden.",

            COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `Du musst eine Rolle definieren ${opt}.`,
            COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Entschuldige, aber ich kann die Rolle nicht finden ${roleName}. Bitte erneut versuchen.`,
            COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Entschuldige, aber ${roleName} ist bereits vorhanden.`,
            COMMAND_SETCONF_PREFIX_TOO_LONG: "Entschuldigung, aber es duerfen keine Leerzeichen im Praefix verwendet werden",
            COMMAND_SETCONF_WELCOME_NEED_CHAN: "Entschuldige, aber der Ankuendigungskanal ist nicht definiert oder nicht mehr gueltig.\nSetze `announceChan` auf einen gueltigen Kanal und versuche es erneut`",
            COMMAND_SETCONF_TIMEZONE_NEED_ZONE: "Ungueltige Zeitzone, gehe zu https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nund suche die du brauchst und gib den Inhalt gemaess der Spalte TZ an",
            COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Entschuldige, aber ich kann diesen Kanal nicht finden ${chanName}. Bitte versuche es erneut.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: "Entschuldige, aber du hast keine Berechtigung diese Nachricht hier zu senden. Entweder muessen die Berechtigungen angepasst werden oder waehle einen anderen Kanal.",
            COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Entschuldige, aber ${value} ist aktuell keine gueltige Sprache. \nUnterstuetzte Sprachen sind: \`${langList}\``,
            COMMAND_SETCONF_RESET: "Die Konfiguration wurde zurueckgesetzt",
            COMMAND_SETCONF_HELP: {
                description: "Zum Bearbeiten der Einstellungen des Bots.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";setconf <Schluessel> <Wert>",
                        args: {}
                    },
                    {
                        action: "prefix",
                        actionDesc: "Setzt den Praefix fuer den Server",
                        usage: ";setconf prefix <Praefix>",
                        args: {}
                    },
                    {
                        action: "adminRole",
                        actionDesc: "Die Rolle, welche die Moeglichkeit haben soll Einstellungen des Bots zu aendern oder Events anlegen kann",
                        usage: ";setconf adminRole <add|remove> <Rolle>",
                        args: {
                            "add":  "Eine Rolle zur Liste hinzufuegen",
                            "remove": "Eine Rolle von der Liste entfernen"
                        }
                    },
                    {
                        action: "enableWelcome",
                        actionDesc: "Schaltet die Willkommensnachricht ein bzw. aus.",
                        usage: ";setconf enableWelcome <true|false>",
                        args: {}
                    },
                    {
                        action: "welcomeMessage",
                        actionDesc: "Die Willkommensnachricht, die gesendet wird, wenn sie eingeschaltet ist (besondere Variablen unten)",
                        usage: ";setconf welcomeMessage <Nachricht>",
                        args: {
                            "{{user}}":  "Wird durch den Benutzernamen ersetzt.",
                            "{{userMention}}": "Taggt den neuen Benutzer."
                        }
                    },
                    {
                        action: "enablePart",
                        actionDesc: "Schaltet die Abschiedsnachricht an/ aus.",
                        usage: ";setconf enablePart <true|false>",
                        args: {}
                    },
                    {
                        action: "partMessage",
                        actionDesc: "Die Abschiedsnachricht die gesendet wird, sofern diese eingeschaltet wurde (spezielle Variablen siehe unten)",
                        usage: ";setconf partMessage <Nachricht>",
                        args: {
                            "{{user}}":  "wird ersetzt durch den Usernamen.",
                        }
                    },
                    {
                        action: "useEmbeds",
                        actionDesc: "Schaltet ein bzw. aus, ob die Ausgabe einiger Kommandos eingebettet werden soll.",
                        usage: ";setconf useEmbeds <true|false>",
                        args: {}
                    },
                    {
                        action: "timezone",
                        actionDesc: "Setzt die Zeitzone die genutzt werden soll. Hier eine Liste der Zeitzonen https://goo.gl/Vqwe49.",
                        usage: ";setconf timezone <Zeitzone>",
                        args: {}
                    },
                    {
                        action: "announceChan",
                        actionDesc: "Setzt den Ankuendigungskanal fuer Events etc. Stelle sicher, dass eine Schreibberechtigung fuer diesen Kanal vorhanden ist.",
                        usage: ";setconf announceChan <KanalName>",
                        args: {}
                    },
                    {
                        action: "useEventPages",
                        actionDesc: "Zeigt Events in Seiten an.",
                        usage: ";setconf useEventPages <true|false>",
                        args: {}
                    },
                    {
                        action: "eventCountdown",
                        actionDesc: "Die Intervalle in denen eine Countdown Nachricht erscheinen soll",
                        usage: ";setconf eventCountdown <add|remove> <Zeit>",
                        args: {
                            "add":  "Fuegt ein Zeitintervall hinzu",
                            "remove": "Entfernt ein Zeitintervall aus der Liste"
                        }
                    },
                    {
                        action: "language",
                        actionDesc: "Stellt die Sprache ein die der Bot fuer die Kommandoausgabe nutzen soll.",
                        usage: ";setconf language <Sprache>",
                        args: {}
                    },
                    {
                        action: "swgohLanguage",
                        actionDesc: "Stellt die Sprache ein die der Bot fuer die Spieldatenausgabe nutzen soll.",
                        usage: ";setconf swgohLanguage <Sprache>",
                        args: {}
                    },
                    // {
                    // action: "reset",
                    // actionDesc: 'Setzt die Konfiguration auf die Standardwerte zurueck (ACHTUNG nur benutzen, wenn du dir sicher bist)',
                    // usage: ';setconf reset',
                    // args: {}
                    // }
                ]
            },

            // Shard times command
            COMMAND_SHARDTIMES_MISSING_USER: "Benutzer wird benoetigt, bitte \"me\" verwenden, einen Benutzer benennen oder eine Discord ID einfuegen.",
            COMMAND_SHARDTIMES_MISSING_ROLE: "Ohne Adminrechte, kannst Du nur Dich selbst angeben..",
            COMMAND_SHARDTIMES_INVALID_USER: "Ungueltiger Benutzer, bitte \"me\" verwenden, einen Benutzer benennen oder eine Discord ID einfuegen.",
            COMMAND_SHARDTIMES_MISSING_TIMEZONE: "Bitte eine Zeitzone eintragen.",
            COMMAND_SHARDTIMES_INVALID_TIMEZONE: "Ungueltige Zeitzone, bitte hier pruefen https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nwelche benoetigt wird, dann eintragen, was in der TZ-Spalte gennant wird",
            COMMAND_SHARDTIMES_INVALID_TIME_TIL: "Ungueltige Zeitangabe bis zum Payout, es muss im folgenden Format angegeben werden `00:00`, d.h. wenn bspw. **13** Minuten bis zum Payout fehlen, dann gibst du `00:13` an",
            COMMAND_SHARDTIMES_USER_ADDED: "Benutzer erfolgreich hinzugefuegt!",
            COMMAND_SHARDTIMES_USER_MOVED: (from, to) => `User aktualisiert von ${from} nach ${to}.`,
            COMMAND_SHARDTIMES_USER_NOT_ADDED: "Etwas lief schief beim Benutzer hinzufuegen, bitte erneut probieren.",
            COMMAND_SHARDTIMES_REM_MISSING_PERMS: "Du kannst nur Dich selbst entfernen, es sei denn Du hast Adminrechte.",
            COMMAND_SHARDTIMES_REM_SUCCESS: "Benutzer erfolgreich entfernt!",
            COMMAND_SHARDTIMES_REM_FAIL: "Etwas lief schief beim entfernen des Benutzers, bitte erneut probieren.",
            COMMAND_SHARDTIMES_REM_MISSING: "Dieser Benutzer scheint hier nicht zu existieren.",
            COMMAND_SHARDTIMES_COPY_NO_SOURCE: "Dieser Kanal hat keine Shard-Zeiten die kopiert werden koennten.",
            COMMAND_SHARDTIMES_COPY_NO_DEST: (input) => `Kein Ergebnis gefunden fuer \`${input}\``,
            COMMAND_SHARDTIMES_COPY_NO_PERMS: (inChan) => `Ich habe keine Berechtigung um Nachrichten in <#${inChan}> zu lesen/schreiben`,
            COMMAND_SHARDTIMES_COPY_SAME_CHAN: "Du kannst nicht von/nach dem selben Kanal kopieren",
            COMMAND_SHARDTIMES_COPY_DEST_FULL: "Entschuldige, aber der Ziel-Kanal hat bereits Shard-Informationen",
            COMMAND_SHARDTIMES_COPY_BROKE: "Etwas hat beim Versuch die Shard-Informationen zu kopieren nicht geklappt. Bitte erneut versuchen.",
            COMMAND_SHARDTIMES_COPY_SUCCESS: (dest) => `Shard-Informationen kopiert nach <#${dest}>`,
            COMMAND_SHARDTIMES_SHARD_HEADER: "Splitterauszahlung in:",
            COMMAND_SHARDTIMES_HELP: {
                description: "Zeigt die Payout-Zeiten von allen registrierten Benutzern an.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: "Benutzer zum Tracker hinzufuegen",
                        usage: ";shardtimes add <Benutzer> <Zeitzone> [Emoji]\n;shardtimes add <Benutzer> <-timeuntil 00:00> [Emoji]",
                        args: {
                            "Benutzer": "Der Benutzer, der hinzugefuegt wird. (me | userID | mention)",
                            "Zeitzone": "Die Zeitzone, die fuer Dich gilt. Verwende diese Liste:\n https://en.wikipedia.org/wiki/List_of_tz_database_time_zones",
                            "Emoji": "OPTIONAL: Ein Emoji, das neben dem Namen angezeigt wird.",
                            "-timeuntil": "Wenn du nur die verbleibende Zeit bis zum Payout anzeigen lassen moechtest"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: "Benutzer vom Splitter-Tracker entfernen",
                        usage: ";shardtimes remove <Benutzer>",
                        args: {
                            "Benutzer": "Der Benutzer, der entfernt werden soll. (me | userID | mention)"
                        }
                    },
                    {
                        action: "Copy",
                        actionDesc: "Kopiert die Liste mit den Zeiten von einem Kanal in einen anderen",
                        usage: ";shardtimes copy <neuerKanal>",
                        args: {
                            "neuerKanal": "Der Ziel-Kanal wohin die Zeiten kopiert werden sollen"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Zeigt alle Zeiten fuer Dich und Deiner Splitter-Gefaehrten an.",
                        usage: ";shardtimes view",
                        args: {
                            "-ships": "Zeigt die Zeiten fuer den Flotten payout an (-ship | -s)"
                        }
                    }
                ]
            },

            // Ships Command
            COMMAND_SHIPS_NEED_CHARACTER: (prefix) => `Benoetigt Charakter oder Schiff. Der Befehl lautet: \`${prefix}ship <Schiff|Pilot\``,
            COMMAND_SHIPS_INVALID_CHARACTER: (prefix) => `Ungueltiger Charakter oder Schiff. Der Befehl lautet: \`${prefix}ship <Schiff|Pilot\``,
            COMMAND_SHIPS_TOO_MANY: "Es wurde mehr als ein Ergebnis gefunden. Bitte spezifizieren Sie Ihre Suche genauer.",
            COMMAND_SHIPS_CREW: "Crew",
            COMMAND_SHIPS_FACTIONS: "Fraktionen",
            COMMAND_SHIPS_ABILITIES: (abilities) => `**Faehigkeitstyp:** ${abilities.type}   **Abklingzeit:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
            COMMAND_SHIPS_CODE_ABILITES_HEADER: " * Faehigkeiten*\n",
            COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nFaehigkeitstyp: ${abilities.type}   Abklingzeit: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
            COMMAND_SHIPS_HELP: {
                description: "Zeigt Infos zum ausgewaehlten Schiff.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "ship <Schiff|Pilot>",
                        args: {
                            "Schiff|Pilot": "Das Schiff oder der Pilot zu dem Informationen angezeigt werden sollen."
                        }
                    }
                ]
            },

            // Showconf Command
            COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `Dies ist die aktuelle Konfiguration für ${serverName}: \`\`\`${configKeys}\`\`\``,
            COMMAND_SHOWCONF_HELP: {
                description: "Zeigt die aktuelle Server Konfiguration an.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";showconf",
                        args: {}
                    }
                ]
            },

            // Squads Command
            COMMAND_SQUADS_NO_LIST: (list) => `Bitte waehle eine Kategorie aus folgender Liste: \n\`${list}\``,
            COMMAND_SQUADS_SHOW_LIST: (name, list) => `In ${name}, bitte waehle die Nummer entsprechend der Phase die du sehen moechtest: \n${list}`,
            COMMAND_SQUADS_FIELD_HEADER: "Teams / Charaktere",
            COMMAND_SQUAD_INVALID_PHASE: (list) => `Ungueltige Phase, bitte waehle eine Nummer aus folgender Liste: \n${list}`,
            COMMAND_SQUADS_HELP: {
                description: "Zeigt Charaktere/Teams die fuer verschiedene Events nuetzlich sind.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";squads [user] <event> <phaseNum>",
                        args: {
                            "user": "Die Person die du sehen moechtest. (me | userID | mention)",
                            "event": "Das Event fuer das du Teams sehen moechtest, (aat|pit|sith|etc.)",
                            "phase": "Die Nummer zur Phase die du sehen moechtest"
                        }
                    }
                ]
            },

            // Stats Command
            COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID, botLangs, players, guilds, gohLangs, updated) => [
                `= STATISTIKEN (${shardID}) =`,
                `• Speicherauslastung  :: ${memUsage} MB`,
                `• CPU Auslastung      :: ${cpuLoad}%`,
                `• Uptime              :: ${uptime}`,
                `• Anwender            :: ${users}`,
                `• Server              :: ${servers}`,
                `• Kanaele             :: ${channels}`,
                `• Sprachen            :: ${botLangs}`,
                "• Quelle              :: https://github.com/jmiln/SWGoHBot\n",
                "= SWGoH Statistik =",
                `• Registrierte Spieler :: ${players}`,
                `• Registrierte Gilden  :: ${guilds}`,
                `• Verfuegbare Sprachen :: ${gohLangs}`,
                `• Client aktualisiert  :: ${updated}`
            ].join("\n"),
            COMMAND_STATS_HELP: {
                description: "Zeigt die Statistiken des Bots an.",
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
                description: "Kommando fuer Testzwecke.",
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
            COMMAND_TIME_CURRENT: (time, zone) => `Aktuelle Uhrzeit is: ${time} in ${zone} Zeit`,
            COMMAND_TIME_INVALID_ZONE: (time, zone) => `Ungueltige Zeitzone, fuer deine Gilde ist es jetzt ${time} in ${zone} Zeit`,
            COMMAND_TIME_NO_ZONE: (time) => `Aktuelle Uhrzeit: ${time} UTC Zeit`,
            COMMAND_TIME_WITH_ZONE: (time, zone) => `Aktuelle Uhrzeit: ${time} in ${zone} Zeit`,
            COMMAND_TIME_HELP: {
                description: "Wird benutzt um die aktuelle Uhrzeit und die eingestellte Zeitzone zu ueberpruefen.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";time [Zeitzone]",
                        args: {
                            "Zeitzone": "Optional falls du sehen moechtest welche Uhrzeit es woanders ist"
                        }
                    }
                ]
            },

            // Updatechar Command
            COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `${arg} ist kein gueltiges Argument. Probiere eines von diesen: ${usableArgs}`,
            COMMAND_UPDATECHAR_NEED_CHAR: "Es muss ein Charakter angegeben werden, um ihn zu aktualisieren.",
            COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Die Suche nach '${charName}' ergab keine Treffer. Bitte erneut versuchen.`,
            COMMAND_UPDATECHAR_HELP: {
                description: "Aktualisiere die Infos zu einem spezifizierten Charakter.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";updatechar [Gear|Info|Mods] [Charakter]",
                        args: {
                            "Gear": "Aktualisiere die Infos zur Ausruestung eines Charakters.",
                            "Info": "Aktualisiere die Infos zu einem Charakter (Link zum Bild, Faehigkeiten etc.)",
                            "Mods": "Aktualisiere die Mods von crouchingrancor.com"
                        }
                    }
                ]
            },

            // UserConf
            COMMAND_USERCONF_CANNOT_VIEW_OTHER: "Entschuldige, aber du kannst keine anderen Einstellungen ansehen",
            COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED: "Dieser Buendniscode ist bereits registriert",
            COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS: (name, ac) => `${name}(${ac}) von der Konfiguration entfernt`,
            COMMAND_USERCONF_ALLYCODE_TOO_MANY: "Du kannst nicht mehr als 10 Accounts registrieren.",
            COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED: "Dieser Buendniscode ist nicht registriert",
            COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY: "Dieser Buendniscode wurde bereits als *primaer* gekennzeichnet.",
            COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY: (oldName, oldAC, newName, newAC) => `Primaer von **${oldName}**(${oldAC}) nach **${newName}**(${newAC}) geaendert`,
            COMMAND_USERCONF_DEFAULTS_CMD_NO_FLAGS: (name) => `${name} hat keine Kennzeichnungen fuer die Standardwerte geladen werden koennten.`,
            COMMAND_USERCONF_DEFAULTS_INVALID_CMD: (name) => `${name} wird aktuell hierfuer nicht unterstuetzt.`,
            COMMAND_USERCONF_DEFAULTS_SET_DEFAULTS: (name, flags) => `Setzt die Standardwerte fuer ${name} auf \`${flags}\``,
            COMMAND_USERCONF_DEFAULTS_NO_DEFAULTS: (name) => `Es wurden keine Standardwerte gesetzt fuer ${name}.`,
            COMMAND_USERCONF_DEFAULTS_CLEARED: (name) => `Standardwerte geloescht fuer ${name}.`,
            COMMAND_USERCONF_VIEW_NO_CONFIG: (prefix) => `Es wurde noch keine Konfiguration eingestellt. Versuche \`${prefix}help userconf\` um zu beginnen.`,
            COMMAND_USERCONF_VIEW_ALLYCODES_HEADER: "Buendniscodes",
            COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY: "__Primaer ist **BOLD**__\n",
            COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC: "Keine verknuepften Buendniscodes.",
            COMMAND_USERCONF_VIEW_DEFAULTS_HEADER: "Standardwerte",
            COMMAND_USERCONF_VIEW_DEFAULTS_NO_DEF: "Setzt Standardwerte fuer deine Kommandos.",
            COMMAND_USERCONF_VIEW_ARENA_HEADER: "Arena Rang PNs",
            COMMAND_USERCONF_VIEW_ARENA_DM: "PN wenn Rang verloren",
            COMMAND_USERCONF_VIEW_ARENA_SHOW: "Zeigt Arena",
            COMMAND_USERCONF_VIEW_ARENA_WARNING: "Payout Meldung",
            COMMAND_USERCONF_VIEW_ARENA_RESULT: "Payout Ergebnis Meldung",
            COMMAND_USERCONF_VIEW_LANG_HEADER: "Spracheinstellung",
            COMMAND_USERCONF_ARENA_PATREON_ONLY: "Dieses Feature ist nur verfuegbar fuer Unterstuetzer auf https://www.patreon.com/swgohbot",
            COMMAND_USERCONF_ARENA_MISSING_DM: "Fehlende Option. Versuche all/primary/off.",
            COMMAND_USERCONF_ARENA_INVALID_DM: "Ungueltige Option. Versuche all/primary/off.",
            COMMAND_USERCONF_ARENA_MISSING_ARENA: "Fehlende arena, Du musst eine der folgenden waehlen: `char, fleet, both`",
            COMMAND_USERCONF_ARENA_INVALID_ARENA: "Ungueltige arena, Du musst eine der folgenden waehlen: `char, fleet, both`",
            COMMAND_USERCONF_ARENA_MISSING_WARNING: "Fehlende Nummer, Versuche `0` um zu deaktivieren, oder eine Anzahl von Minuten bevor die Warnung erscheinen soll.",
            COMMAND_USERCONF_ARENA_INVALID_WARNING: "Ungueltige Nummer, Versuche `0` um zu deaktivieren, oder eine Anzahl von Minuten bevor die Warnung erscheinen soll.",
            COMMAND_USERCONF_ARENA_INVALID_NUMBER: "Ungueltige Nummer, deine Nummer muss zwischen 0 (deaktiviert), und 1440 (ein Tag) sein.",
            COMMAND_USERCONF_ARENA_INVALID_OPTION: "Versuche eine der folgenden: `enableDMs, arena, payoutResult, payoutWarning`",
            COMMAND_USERCONF_ARENA_INVALID_BOOL: "Ungueltige Option. Versuche `yes/no`, `true/false` oder `on/off`",
            COMMAND_USERCONF_ARENA_UPDATED: "Deine Einstellungen wurden aktualisiert.",
            COMMAND_USERCONF_LANG_UPDATED: (type, newLang) => `Deine ${type} wurde aktualisiert auf ${newLang}`,
            COMMAND_USERCONF_HELP: {
                description: "Alle Utilities um deine Informationen im Bot zu verwalten.",
                actions: [
                    {
                        action: "View",
                        actionDesc: "Zeigt die gegenwaertigen Einstellungen an.",
                        usage: ";userconf view",
                        args: { }
                    },
                    {
                        action: "Buendniscode",
                        actionDesc: "Gibt die Buendniscodes zur Verwendung mit anderen Kommandos frei",
                        usage: ";userconf allycode <add|remove|makeprimary> <Buendniscode>",
                        args: {
                            "add": "Fuegt einen Buendniscode dem Profil hinzu",
                            "remove": "Entfernt einen Buendniscode von deinem Profil",
                            "makePrimary": "Setzt den gewaehlten Buendniscode als 'primaer' (derjenige der genutzt wird wenn `me` in einem befehl genutzt wird)"
                        }
                    },
                    {
                        action: "Defaults",
                        actionDesc: "Setzt Standardwerte fuer die Kommandos",
                        usage: ";userconf defaults <set> <commandName> <flags>\n;userconf defaults <clear> <commandName>",
                        args: {
                            "commandName": "Der Name (oder alias) des Kommandos fuer den du Standardwerte setzen willst.",
                            "flags": "Eine Kennzeichnung fuer die du einen Standartwert setzen moechtest"
                        }
                    },
                    {
                        action: "Arena Alert",
                        actionDesc: "Setzt eine Warnung als PN wenn du deinen Rang verlierst oder andere Arena-bezogenen Themen.",
                        usage: [
                            ";userconf arenaAlert enableDMs <all|primary|off>",
                            ";userconf arenaAlert arena <both|fleet|char>",
                            ";userconf arenaAlert payoutResult <on|off>",
                            ";userconf arenaAlert payoutWarning <0-1439>"
                        ].join("\n"),
                        args: {
                            "enableDMs": "Aktiviert PN Warnungen fuer den primaeren Buendniscode, alle Buendniscodes oder Keinen",
                            "arena": "Waehle welche Arena Warnungen du sehen moechtest",
                            "payoutResult": "Schickt eine PN mit deiner endgueltigen Arena-Platzierung",
                            "payoutWarning": "Schickt eine PN Minuten vor deinem payout. 0 schaltet die Funktion ab."
                        }
                    },
                    {
                        action: "Sprachen",
                        actionDesc: "Setzt persoenliche Lokalisierungseinstellungen",
                        usage: [
                            ";userconf lang language <SprachenAuswahl>",
                            ";userconf lang swgohLanguage <SprachenAuswahl>"
                        ].join("\n"),
                        args: {
                            langChoice: ["Die Sprache die du auswaehlen moechtest.",
                                `**Sprachoptionen:** ${langList.join(", ")}`,
                                `**Swgoh-Sprachoptionen:** ${swgohLangList.join(", ")}`
                            ].join("\n")
                        }
                    }
                ]
            },

            // Zetas Command
            COMMAND_ZETA_NO_USER: "Entschuldigung, aber diesen User kann ich nicht finden.",
            COMMAND_ZETA_NO_ZETAS: "Keine Faehigkeiten mit Zeta gefunden.",
            COMMAND_ZETA_OUT_DESC: "`------------------------------`\n`[L]` Anfuehrer | `[S]` Spezial | `[U]` Einzigartig\n`------------------------------`",
            COMMAND_ZETA_MORE_INFO: "`;zeta <character>` fuer mehr Info.",
            COMMAND_ZETA_REC_BAD_FILTER: (filters) => `Ungueltiger Filter, bitte einen von diesen verwenden \`${filters}\``,
            COMMAND_ZETA_REC_HEADER: "Verfuegbare Filter:",
            COMMAND_ZETA_REC_AUTH: (zetaLen, pName) => `Top ${zetaLen}zetas fuer ${pName}`,
            COMMAND_ZETA_CONFLICTING_FLAGS: "Entschuldigung, aber du kannst die beiden Schalter -r und -g nicht gleichzeitig verwenden.",
            COMMAND_ZETA_WAIT_GUILD: "Bitte warten waehrend ich die Zetas deiner Gilde durchsuche",
            COMMAND_ZETA_ZETAS_HEADER: (name, count) => `${name}'s Zetas (${count})`,
            COMMAND_ZETA_GUILD_HEADER: (name) => `${name}'s Zetas'`,
            COMMAND_ZETA_GUILD_CHAR_HEADER: (name) => `${name}'s Zetas'`,
            COMMAND_ZETAS_HELP: {
                description: "Zeigt die Faehigkeiten die mit Zeta hochgestuft wurden.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";zeta [user]",
                        args: {
                            "user": "Das Discordprofil vom Spieler den du sehen moechtest. (me | userID | mention)"
                        }
                    },
                    {
                        action: "Empfehlung",
                        actionDesc: "Empfohlene Zetas fuer verschiedene Bereiche im Spiel",
                        usage: ";zeta -r [-h] [user] [filter]",
                        args: {
                            "-h": "Gibt nur die 7* Charaktere aus. (Bspw. wenn du nur Charaktere fuer einen heroischen Raid suchst)",
                            "user": "Das Discordprofil vom Spieler den du sehen moechtest. (me | userID | mention)",
                            "filter": "Zeigt die empfohlenen Zetas in Abhaengigkeit des verwendeten Filters an"
                        }
                    },
                    {
                        action: "Gilde",
                        actionDesc: "Zeigt eine Uebersicht der Zetas in deiner Gilde an, oder pro Charakter (WARNUNG: Das kann sehr spammy sein)",
                        usage: ";zeta -g [user] [character]",
                        args: {
                            "user": "Die Gilde des Spielers den du sehen willst. (me | userID | mention)",
                            "character": "Der Charakter der in der Gilde die Zetafaehigkeit hat"
                        }
                    }
                ]
            }
        };
    }
};
