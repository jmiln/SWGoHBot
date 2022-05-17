const langList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];
const swgohLangList = ["de_DE", "en_US", "es_SP", "ko_KR", "pt_BR"];
const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: "일",
        LONG: "일요일"
    },
    MONDAY: {
        SHORT: "월",
        LONG: "월요일"
    },
    TUESDAY: {
        SHORT: "화",
        LONG: "화요일"
    },
    WEDNESDAY: {
        SHORT: "수",
        LONG: "수요일"
    },
    THURSDAY: {
        SHORT: "목",
        LONG: "목요일"
    },
    FRIDAY: {
        SHORT: "금",
        LONG: "금요일"
    },
    SATURDAY: {
        SHORT: "토",
        LONG: "토요일"
    }
};
const TIMES = {
    DAY: {
        PLURAL: "일",
        SING: "일",
        SHORT_PLURAL: "일",
        SHORT_SING: "일"
    },
    HOUR: {
        PLURAL: "시간",
        SING: "시간",
        SHORT_PLURAL: "시간",
        SHORT_SING: "시간"
    },
    MINUTE: {
        PLURAL: "분",
        SING: "분",
        SHORT_PLURAL: "분",
        SHORT_SING: "분"
    },
    SECOND: {
        PLURAL: "초",
        SING: "초",
        SHORT_PLURAL: "초",
        SHORT_SING: "초"
    }
};

export const language = {
    // Function to get one of the strings here
    getString(stringId: string, ...args: any[]) {
        if (args.length && typeof language[stringId] === "function") {
            return language[stringId](...args);
        } else {
            return language[stringId];
        }
    },

    // Some helper functions for day/ time strings
    getDay:  (day: string, type: string)  => DAYSOFWEEK[`${day}`][`${type}`],
    getTime: (unit: string, type: string) => TIMES[`${unit}`][`${type}`],

    // Default in case it can't find one.
    BASE_DEFAULT_MISSING: "없는 단어를 사용하려고 합니다. 이 메시지를 보시면, 수정할 수 있도록 알려주시면 감사하겠습니다.",

    // Base swgohBot.js file
    BASE_LAST_EVENT_NOTIFICATION: "\n\n이번 이벤트의 마지막입니다. 이 안내를 계속 받으시려면, 새 이벤트를 만드세요.",
    BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\n${timeToGo} 내로 시작합니다`,

    // Base swgohAPI
    BASE_SWGOH_NO_ALLY: "죄송합니다만 사용자가 등록되어있지 않습니다. 다음 명령을 사용하여 등록해주십시오 `;register add <user> <allycode>`",
    BASE_SWGOH_NOT_REG: (user) => `죄송합니다만 사용자가 등록되어있지 않습니다. 다음 명령을 사용하여 등록해주십시오 \`;register add @${user} <allycode>\``,
    BASE_SWGOH_NO_USER: "죄송합니다만 사용자가 등록되어있지 않습니다.",
    BASE_SWGOH_MISSING_CHAR: "확인할 캐릭터를 입력하여 주십시오",
    BASE_SWGOH_NO_CHAR_FOUND: (character) => `${character}에 대한 결과를 찾을 수 없습니다`,
    BASE_SWGOH_CHAR_LIST: (chars) => `검색 결과가 너무 많습니다. 검색어를 조금 더 자세히 지정해주십시오. \n가장 비슷한 결과는 다음과 같습니다.\n\`\`\`${chars}\`\`\``,
    BASE_SWGOH_NO_ACCT: "문제가 발생했습니다. 계정이 정확히 연동됐는지 확인해주십시오.",
    BASE_SWGOH_LAST_UPDATED: (date) => `${date} 전에 마지막으로 갱신되었습니다`,
    BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `${dType ? dType : "data"}를 가져오기까지 잠시만 기다려주십시오`,

    // Generic (Not tied to a command)
    COMMAND_EXTENDED_HELP: (command) => `**${command.help.name}에 대한 더 자세한 도움말** \n**사용법**: ${command.help.usage} \n${command.help.extended}`,
    COMMAND_INVALID_BOOL: "잘못된 값입니다. true 혹은 false를 사용해주십시오",
    COMMAND_MISSING_PERMS: "죄송합니다만 적합한 권한이 없습니다.",
    BASE_COMMAND_UNAVAILABLE: "이 명령어는 개인 메시지로는 사용할 수 없습니다. 길드 내에서 이 명령어를 사용하시기 바랍니다.",
    BASE_COMMAND_HELP_HEADER: (name) => `${name}에 대한 도움말`,
    BASE_COMMAND_HELP_HEADER_CONT: (name) => `${name}에 대한 도움말(계속)`,
    BASE_COMMAND_HELP_HELP: (name) => {
        return {
            action: "Show help",
            actionDesc: "이 메시지를 보여줍니다",
            usage: `;${name} help`,
            args: {}
        };
    },
    BASE_MOD_TYPES: {
        SQUARE:  "Square",
        ARROW:   "Arrow",
        DIAMOND: "Diamond",
        TRIANGLE:"Triangle",
        CIRCLE:  "Circle",
        CROSS:   "Cross",
        ACCURACY:   "명중률",
        CRITCHANCE: "치명타 확률",
        CRITDAMAGE: "치명타 피해",
        DEFENSE:    "방어력",
        HEALTH:     "체력",
        OFFENSE:    "공격력",
        POTENCY:    "효력",
        SPEED:      "속도",
        TENACITY:   "인내"
    },

    // Abilities Command
    COMMAND_ABILITIES_NEED_CHARACTER: (prefix) => `캐릭터가 필요합니다. 다음과 같이 사용하십시오. \`${prefix}abilities <characterName>\``,
    COMMAND_ABILITIES_INVALID_CHARACTER: (prefix) => `잘못된 캐릭터입니다. 다음과 같이 사용하십시오. \`${prefix}abilities <characterName>\``,
    COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**능력 쿨다운:** ${aCooldown}\n`,
    COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**능력 종류:** ${aType}     **필요한 최상위 능력 재료:**  ${mat}\n${cdString}${aDesc}`,
    COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* 능력 종류: ${type}\n* 필요한 최상위 능력 재료: ${tier}\n* 설명: ${aDesc}\n\n`,
    COMMAND_ABILITIES_HELP: {
        description: "특정 캐릭터의 기술을 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";abilities <characterName>",
                args: {}
            }
        ]
    },

    // Activities Command
    COMMAND_ACTIVITIES_SUNDAY: "== 리셋 전 == \n아레나 전투 완료 \n칸티나 사용 안함 \n일반 에너지 사용 안함\n\n== 리셋 후 == \n칸티나 에너지 사용 \n일반 에너지 사용 안함",
    COMMAND_ACTIVITIES_MONDAY: "== 리셋 전 == \n칸티나 에너지 사용 \n일반 에너지 사용 안함 \n\n== 리셋 후 == \n라이트 사이드 전투에 일반 에너지 사용 ",
    COMMAND_ACTIVITIES_TUESDAY: "== 리셋 전 == \n라이트 사이드 전투에 일반 에너지 사용 \n모든 종류의 에너지 사용 안함\n\n== 리셋 후 == \n모든 종류의 에너지 사용 \n일반 에너지 사용 안함",
    COMMAND_ACTIVITIES_WEDNESDAY: "== 리셋 전 == \n모든 종류의 에너지 사용 \n일반 에너지 사용 안함\n\n== 리셋 후 == \n어려움 전투에 일반 에너지 사용",
    COMMAND_ACTIVITIES_THURSDAY: "== 리셋 전 == \n어려움 전투에 일반 에너지 사용 \n챌린지 안함\n\n== 리셋 후 == \n챌린지 완료 \n일반 에너지 사용 안함",
    COMMAND_ACTIVITIES_FRIDAY: "== 리셋 전 == \n챌린지 완료 \n일반 에너지 사용 안함\n\n== 리셋 후 == \n다크 사이드 전투에 일반 에너지 사용",
    COMMAND_ACTIVITIES_SATURDAY: "== 리셋 전 == \n다크 사이드 전투에 일반 에너지 사용 \n아레나 전투 안함 \n칸티나 에너지 사용 안함\n\n== 리셋 후 == \n아레나 전투 완료 \n컨티나 에너지 사용 안함",
    COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `잘못된 요일입니다. 사용법은 다음과 같습니다 \`${prefix}${usage}\``,
    COMMAND_ACTIVITIES_HELP: {
        description: "요일별 길드 활동을 알려줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";activities [dayOfWeek]",
                args: {}
            }
        ]
    },

    // Arenarank Command
    COMMAND_ARENARANK_INVALID_NUMBER: "정확한 등수를 입력해야 합니다",
    COMMAND_ARENARANK_BEST_RANK: "최고 등수입니다. 축하합니다!",
    COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `현재 ${currentRank} 위에서 , ${battleCount} 번의 전투로 ${est}\n다음과 같이 진행할 수 있습니다. \n${rankList}`,
    COMMAND_ARENARANK_HELP: {
        description: "아레나 전투를 전부 이길 경우 오를 수 있는 최고 순위(추정)를 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";arenarank <currentRank> [battleCount]",
                args: {}
            }
        ]
    },

    // Challenges Command
    COMMAND_CHALLENGES_TRAINING: "훈련 드로이드",
    COMMAND_CHALLENGES_ABILITY : "능력 재료",
    COMMAND_CHALLENGES_BOUNTY  : "현상금 사냥꾼",
    COMMAND_CHALLENGES_AGILITY : "민첩 장비",
    COMMAND_CHALLENGES_STRENGTH: "힘 장비",
    COMMAND_CHALLENGES_TACTICS : "전술 장비",
    COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "함선 강화 드로이드",
    COMMAND_CHALLENGES_SHIP_BUILDING   : "함선 제작 재료",
    COMMAND_CHALLENGES_SHIP_ABILITY    : "함선 능력 재료",
    COMMAND_CHALLENGES_MISSING_DAY: "특정 요일을 지정해주십시오",
    COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `잘못된 요일입니다. 사용법은 다음과 같습니다 \`${prefix}${usage}\``,
    COMMAND_CHALLENGES_HELP: {
        description: "요일별 길드 챌린지를 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";challenges <dayOfWeek>",
                args: {}
            }
        ]
    },

    // Changelog Command (Help)
    COMMAND_CHANGELOG_HELP: {
        description: "변경 기록을 DB에 남기고, 변경 기록 채널로 알립니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "changelog <message>",
                args: {
                    "message": "변경 내용을 정리하기 위해 다음을 사용하십시오 [Updated], [Fixed], [Removed], [Added]"
                }
            }
        ]
    },

    // Character gear Command
    COMMAND_CHARGEAR_NEED_CHARACTER: (prefix) => `캐릭터가 필요합니다. 사용법은 다음과 같습니다. \`${prefix}charactergear <character> [starLvl]\``,
    COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix) => `잘못된 캐릭터 입니다. 사용법은 다음과 같습니다. \`${prefix}charactergear <character> [starLvl]\``,
    COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### 필요 장비 전체 목록 ### \n${gearString}`,
    COMMAND_CHARGEAR_GEAR_NA: "이 장비 목록은 아직 입력이 되어있지 않습니다",
    COMMAND_CHARACTERGEAR_HELP: {
        description: "특정 캐릭터/레벨에 필요한 장비 목록을 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "charactergear <character> [gearLvl]",
                args: {}
            }
        ]
    },

    // MyMods Command
    COMMAND_MYMODS_NO_MODS: (charName) => `죄송합니다만 ${charName}가 사용하고 있는 모드가 없습니다`,
    COMMAND_MYMODS_MISSING_MODS: "죄송합니다만 당장은 모드를 찾을 수가 없습니다. 잠시 후에 다시 시도해보시기 바랍니다.",
    COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `최근 모드 수정: ${lastUpdated} 전`,
    COMMAND_MYMODS_HELP: ({
        description: "지정된 캐릭터가 사용하고 있는 모드를 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";mymods [user] <character>",
                args: {
                    "user": "캐릭터를 소유하고 있는 사용자 (me | userID | mention)",
                    "character": "모드를 확인하려는 캐릭터"
                }
            }
        ]
    }),

    // Command Report Command
    COMMAND_COMMANDREPORT_HELP: ({
        description: "지난 10일 동안 실행된 모든 명령어를 보여줍니다",
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
    COMMAND_CURRENTEVENTS_HEADER: "SWGoH 이벤트 일정",
    COMMAND_CURRENTEVENTS_DESC: (num) => `다음 ${num} 개의 이벤트.\n주의: *날자는 변경 가능성이 있습니다.*`,
    COMMAND_CURRENTEVENTS_HELP: {
        description: "다가올 이벤트를 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";currentevents [num]",
                args: {
                    "num": "보고 싶은 이벤트 갯수(최대값)"
                }
            }
        ]
    },

    // Event Command (Create)
    COMMAND_EVENT_INVALID_ACTION: (actions) => `다음과 같은 일을 할 수 있습니다 \`${actions}\`.`,
    COMMAND_EVENT_INVALID_PERMS: "죄송합니다만 관리자가 아니시거나, 서버 관리자가 적절한 설정을 하지 않은 상태입니다.\n관리자 역할이 설정되어 있지 않으면 이벤트를 추가하거나 삭제할 수 없습니다.",
    COMMAND_EVENT_ONE_REPEAT: "죄송합니다만 하나의 이벤트에서 `repeat`와 `repeatDay`를 동시에 사용할 수 없습니다. 둘중 하나를 선택하십시오",
    COMMAND_EVENT_INVALID_REPEAT: "반복을 지정하는 형식이 잘못되었습니다. 예: `5d3h8m` 5일 3시간 8분",
    COMMAND_EVENT_USE_COMMAS: "repeadDay에서 콤마를 사용하여 숫자를 분리해주십시오. 예: `1,2,1,3,4`",
    COMMAND_EVENT_INVALID_CHAN: "이 채널은 유효하지 않습니다. 다시 시도해주십시오",
    COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `${channel} 채널에 메시지를 보낼 권한이 없습니다. 권한이 있는 채널을 선택해주십시오`,
    COMMAND_EVENT_NEED_CHAN: "ERROR: 이 내용을 보낼 채널을 설정하셔야 합니다. 이벤트를 만드시려면 `announceChan`을 설정해주십시오.",
    COMMAND_EVENT_NEED_NAME: "이벤트에 이름을 지정해야 합니다.",
    COMMAND_EVENT_EVENT_EXISTS: "같은 이벤트 이름이 이미 존재합니다. 중복은 불가능합니다.",
    COMMAND_EVENT_NEED_DATE: "이벤트에는 날자를 지정해야 합니다. 다음의 형식을 사용해주십시오 `DD/MM/YYYY`.",
    COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate}는 잘못된 날자형식입니다. 다음의 형식을 사용해주십시오 \`DD/MM/YYYY\`.`,
    COMMAND_EVENT_NEED_TIME: "이벤트에는 시간을 지정해야 합니다",
    COMMAND_EVEMT_INVALID_TIME: "이벤트에는 시간을 지정해야 합니다. 다음의 형식을 사용해주십시오 `HH:MM` 24시간 형식입니다. 오전, 오후는 사용하지 않습니다",
    COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `과거 날자에 이벤트를 만들 수 없습니다. ${eventDATE}는 ${nowDATE} 보다 이전입니다`,
    COMMAND_EVENT_CREATED: (eventName, eventDate) => `\`${eventName}\` 이벤트가 ${eventDate}에 설정되었습니다`,
    COMMAND_EVENT_NO_CREATE: "이벤트 설정이 실패하였습니다. 다시 시도해주십시오",
    COMMAND_EVENT_TOO_BIG:(charCount) => `죄송합니다만 이벤트 이름이나 메시지가 너무 깁니다. 적어도 ${charCount} 글자는 짧게 해주셔야 합니다.`,

    // Event Command (View)
    COMMAND_EVENT_TIME_LEFT: (timeLeft) => `남은 시간: ${timeLeft}\n`,
    COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \n이벤트 시간: ${eventDate}\n`,
    COMMAND_EVENT_CHAN: (eventChan) => `채널로 전송중입니다: ${eventChan}\n`,
    COMMAND_EVENT_SCHEDULE: (repeatDays) => `반복 일정: ${repeatDays}\n`,
    COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `매 ${eventDays} 일, ${eventHours} 시간  ${eventMins} 분 마다 반복합니다\n`,
    COMMAND_EVENT_MESSAGE: (eventMsg) => `이벤트 메시지: \n\`\`\`md\n${eventMsg}\`\`\``,
    COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `해당 이벤트를 찾을 수 없습니다 \`${eventName}\``,
    COMMAND_EVENT_NO_EVENT: "현재 계획된 이벤트가 없습니다.",
    COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `이벤트 일정입니다 \n(총 ${eventCount} 개 이벤트) ${PAGE_SELECTED} 페이지/${PAGES_NEEDED}: \n${eventKeys}`,
    COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `이벤트 일정입니다 \n(총 ${eventCount} 개 이벤트): \n${eventKeys}`,

    // Event Command (Delete)
    COMMAND_EVENT_DELETE_NEED_NAME: "삭제하려는 이벤트 이름을 적으십시오",
    COMMAND_EVENT_DOES_NOT_EXIST: "그런 이벤트가 없습니다",
    COMMAND_EVENT_DELETED: (eventName) => `삭제된 이벤트: ${eventName}`,

    // Event Command (Trigger)
    COMMAND_EVENT_TRIGGER_NEED_NAME: "시작하려는 이벤트 이름을 적으십시오",

    // Event Command (Help)
    COMMAND_EVENT_HELP: {
        description: "이벤트의 생성, 삭제, 확인에 사용됩니다",
        actions: [
            {
                action: "Create",
                actionDesc: "새로운 이벤트를 생성합니다",
                usage: ";event create <eventName> <eventDay> <eventTime> [eventMessage]",
                args: {
                    "--repeat <repeatTime>": "00d00h00m 형식으로 이벤트 지속 시간을 설정합니다. 지정된 시간이 지나면 반복 시작됩니다",
                    "--repeatDay <schedule>": "0,0,0,0,0 형식으로 지정된 날자 이후에 반복됩니다",
                    "--channel <channelName>": "이벤트를 안내할 채널을 설정합니다",
                    "--countdown": "이벤트가 시작되는 카운트다운을 설정합니다"
                }
            },
            {
                action: "View",
                actionDesc: "현재 이벤트 목록를 보여줍니다",
                usage: ";event view [eventName]",
                args: {
                    "--min": "이벤트 메시지를 제외한 이벤트 목록을 보여줍니다",
                    "--page <page#>": "이벤트 목록에서 보고 싶은 페이지를 선택합니다"
                }
            },
            {
                action: "Delete",
                actionDesc: "이벤트를 삭제합니다",
                usage: ";event delete <eventName>",
                args: {}
            },
            {
                action: "Trigger",
                actionDesc: "지정된 채널에서 이벤트를 시작합니다",
                usage: ";event trigger <eventName>",
                args: {}
            }
        ]
    },

    // Faction Command
    COMMAND_FACTION_INVALID_CHAR: (prefix) => `잘못된 팩션입니다. 사용법은 다음과 같습니다 \`${prefix}faction <faction>\``,
    COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# ${searchName} 팩션에 소속된 캐릭터들 입니다 # \n${charString}`,
    COMMAND_FACTION_HELP: {
        description: "지정된 팩션에 소속된 캐릭터들을 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "faction <faction>",
                args: {
                    "faction": "소속원들을 확인하고 싶은 팩션 이름. \n게임 내에서 나오는 이름과 같습니다. 예로 저항군은 rebels가 아니라 rebel을 씁니다"
                }
            }
        ]
    },

    // Guilds Command
    COMMAND_GUILDS_MORE_INFO: "지정된 길드에 대한 추가 정보:",
    COMMAND_GUILDS_HELP: {
        description: "최고 길드들의  목록과 사용자 길드에 소속된 인원 목록.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";guild [user]",
                args: {
                    "user": "길드를 확인하기 위한 사용자 아이디. (mention | allyCode | guildName)"
                }
            }
        ]
    },

    // GuildSearch Command
    COMMAND_GUILDSEARCH_BAD_STAR: "1-7 까지만 선택할 수 있습니다",
    COMMAND_GUILDSEARCH_MISSING_CHAR: "확인을 원하는 캐릭터의 이름을 입력하십시오",
    COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `${character}에 대한 결과가 없습니다`,
    COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `검색 결과가 너무 많습니다. 조금 더 자세하게 검색해주십시오. \n가장 비슷한 결과는 다음과 같습니다.\n\`\`\`${chars}\`\`\``,
    COMMAND_GUILDSEARCH_FIELD_HEADER: (tier, num, setNum="") => `${tier} Star (${num}) ${setNum.length > 0 ? setNum : ""}`,
    COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `${starLvl}성 캐릭터를 가진 사람이 길드 내에 없습니다.`,
    COMMAND_GUILDSEARCH_NO_CHAR: "길드내에 이 캐릭터를 가진 사람이 없습니다.",
    COMMAND_GUILDSEARCH_HELP: {
        description: "길드 내에서 지정된 캐릭터를 가진 사람들의 목록을 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";guildsearch [user] <character> [-ships] [starLvl]",
                args: {
                    "user": "사용자를 지정할 경우 (me | userID | mention)",
                    "character": "찾고 싶은 캐릭터 이름.",
                    "-ships": "함선을 찾고 싶은 경우 다음을 사용하십시오 `-s, -ship, or -ships`",
                    "starLvl": "몇성 짜리를 찾을 지 지정할 경우."
                }
            }
        ]
    },

    // Heists Command
    COMMAND_HEISTS_HEADER: "SWGoH 강탈 일정",
    COMMAND_HEISTS_CREDIT: (date) => `**크레딧** : ${date}\n`,
    COMMAND_HEISTS_DROID: (date) => `**드로이드**  : ${date}\n`,
    COMMAND_HEISTS_NOT_SCHEDULED: "`일정 없음`",
    COMMAND_HEISTS_HELP: {
        description: "강탈 일정을 보여줍니다.",
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
    COMMAND_HELP_HEADER: (prefix) => `= 명령어 목록 =\n\n[자세한 내용은 다음 명령을 사용하십시오. ${prefix}help <commandname>]\n`,
    COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \n별명:: ${command.conf.aliases.join(", ")}\n사용법:: ${prefix}${command.help.usage}`,
    COMMAND_HELP_HELP: {
        description: "사용 가능한 명령어에 대한 정보를 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";help [command]",
                args: {
                    "command": "자세한 정보를 알고 싶은 명령어."
                }
            }
        ]
    },

    // Info Command
    COMMAND_INFO_OUTPUT: (guilds) => ({
        "header": "정보",
        "desc": ` \n현재 **${guilds}** 서버에서 운영중 \n`,
        "links": {
            "Invite me": "이 로봇을 초대하세요 http://swgohbot.com/invite",
            "Support Server": "질문이 있는 경우, 도움을 주고 싶은 경우 혹은 그냥 들려보고 싶은 경우 여기로 들려보세요. https://discord.gg/FfwGvhr",
            "Support the Bot": "로봇의 원본 소스는 github에 있습니다 https://github.com/jmiln/SWGoHBot, 도움은 언제나 환영합니다. \n\n혹시 관심이 있으시면 patreon도 들려보세요 https://www.patreon.com/swgohbot."
        }
    }),
    COMMAND_INFO_HELP: {
        description: "로봇과 관련있는 정보들",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "info",
                args: {}
            }
        ]
    },

    COMMAND_MODS_CRIT_CHANCE_SET: "치명타 확률 x2",
    COMMAND_MODS_CRIT_DAMAGE_SET: "치명타 피해 x4",
    COMMAND_MODS_SPEED_SET: "속도 x4",
    COMMAND_MODS_TENACITY_SET: "인내 x2",
    COMMAND_MODS_OFFENSE_SET: "공력력 x4",
    COMMAND_MODS_POTENCY_SET: "효력 x2",
    COMMAND_MODS_HEALTH_SET: "체력 x2",
    COMMAND_MODS_DEFENSE_SET: "방어력 x2",
    COMMAND_MODS_EMPTY_SET: " ",

    COMMAND_MODS_ACCURACY_STAT: "정확도",
    COMMAND_MODS_CRIT_CHANCE_STAT: "치명타 확률",
    COMMAND_MODS_CRIT_DAMAGE_STAT: "치명타 피해",
    COMMAND_MODS_DEFENSE_STAT: "방어력",
    COMMAND_MODS_HEALTH_STAT: "체력",
    COMMAND_MODS_OFFENSE_STAT: "공격력",
    COMMAND_MODS_PROTECTION_STAT: "보호",
    COMMAND_MODS_POTENCY_STAT: "효력",
    COMMAND_MODS_SPEED_STAT: "속도",
    COMMAND_MODS_TENACITY_STAT: "인내",
    COMMAND_MODS_UNKNOWN: "불명",

    // Mods Command
    COMMAND_MODS_NEED_CHARACTER: (prefix) => `캐릭터 이름이 필요합니다. 사용법은 다음과 같습니다 \`${prefix}mods <characterName>\``,
    COMMAND_MODS_INVALID_CHARACTER: (prefix) => `잘못된 캐릭터입니다. 사용법은 다음과 같습니다 \`${prefix}mods <characterName>\``,
    COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) => `\`Square:   ${square}\`\n\`Arrow:    ${arrow}\`\n\`Diamond:  ${diamond}\`\n`,
    COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Triangle: ${triangle}\`\n\`Circle:   ${circle}\`\n\`Cross:    ${cross}\`\n`,
    COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### 세트 ###**\n${modSetString}\n**### 주능력치 ###**\n${modPrimaryString}`,
    COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) => `* Square:   ${square}  \n* Arrow:    ${arrow} \n* Diamond:  ${diamond}\n`,
    COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Triangle: ${triangle}\n* Circle:   ${circle}\n* Cross:    ${cross}`,
    COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### 세트 ### \n${modSetString}\n### 주능력치 ###\n${modPrimaryString}`,
    COMMAND_NO_MODSETS: "이 캐릭터에 모드 세트가 없습니다",
    COMMAND_MODS_HELP: {
        description: "지정된 캐릭터에 추천하는 모드를 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "mods <character>",
                args: {
                    "character": "모드를 보기 원하는 캐릭터 이름"
                }
            }
        ]
    },

    // Modsets command
    COMMAND_MODSETS_OUTPUT: "* 치명타 확률:  2\n* 치명타 피해:  4\n* 방어력:  2\n* 체력:    2\n* 공격력:  4\n* 효력:    2\n* 속도:    4\n* 인내:    2",
    COMMAND_MODSETS_HELP: {
        description: "세트를 구성하기 위해 필요한 모드의 갯수를 보여줍니다.",
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
    COMMAND_MYARENA_NO_USER: (user) => `죄송합니다만 ${user}에 대한 아레나 자료를 찾을 수 없습니다. 계정이 연동되었는지 확인하십시오`,
    COMMAND_MYARENA_NO_CHAR: "문제가 생겼습니다. 캐릭터 자료를 가져올 수가 없습니다.",
    COMMAND_MYARENA_ARENA: (rank) => `분대 아레나 (순위: ${rank})`,
    COMMAND_MYARENA_FLEET: (rank) => `함대 아레나 (순위: ${rank})`,
    COMMAND_MYARENA_EMBED_HEADER: (playerName) => `${playerName}의 아레나`,
    COMMAND_MYARENA_EMBED_FOOTER: (date) => `아레나 정보 시점: ${date}`,
    COMMAND_MYARENA_HELP: {
        description: "사용자의 아레나 순위와 팀 구성을 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";myarena [user]",
                args: {
                    "user": "확인하고 싶은 사용자. (me | userID | mention)"
                }
            }
        ]
    },

    // MyProfile Command
    COMMAND_MYPROFILE_NO_USER: (user) => `죄송합니다만 ${user}에 대한 아레나 자료를 찾을 수 없습니다. 계정이 연동되었는지 확인하십시오`,
    COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `${playerName}의 프로파일 (${allyCode})`,
    COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `아레나 정보 시점: ${date}`,
    COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank) => `**길드:** ${guildName}\n**레벨:** ${level}\n**분대 아레나 순위:** ${charRank}\n**암대 아레나 순위:** ${shipRank}`,
    COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount) => ({
        header: `Characters (${charList.length})`,
        stats: [
            `Char GP  :: ${gpChar}`,
            `7 Star   :: ${charList.filter(c => c.rarity === 7).length}`,
            `lvl 85   :: ${charList.filter(c => c.level === 85).length}`,
            `Gear 12  :: ${charList.filter(c => c.gear === 12).length}`,
            `Gear 11  :: ${charList.filter(c => c.gear === 11).length}`,
            `Zetas    :: ${zetaCount}`
        ].join("\n")
    }),
    COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
        header: `Ships (${shipList.length})`,
        stats: [
            `Ship GP :: ${gpShip}`,
            `7 Star  :: ${shipList.filter(s => s.rarity === 7).length}`,
            `lvl 85  :: ${shipList.filter(s => s.level === 85).length}`
        ].join("\n")
    }),
    COMMAND_MYPROFILE_HELP: {
        description: "사용자의 현재 상태를 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";myprofile [user]",
                args: {
                    "user": "확인하고 싶은 사용자. (me | userID | mention)"
                }
            }
        ]
    },

    // Nickname Command
    COMMAND_NICKNAME_SUCCESS: "별명을 바꿨습니다.",
    COMMAND_NICKNAME_FAILURE: "죄송합니다만 별명을 바꿀 권한이 없습니다.",
    COMMAND_NICKNAME_TOO_LONG: "죄송합니다만 이름은 32자 이내여야 합니다.",
    COMMAND_NICKNAME_HELP: {
        description: "서버에서 사용하는 로봇의 별명을 변경합니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";nickname <name>",
                args: {
                    "name": "바꾸고 싶은 별명. 기본 값을 사용하시려면 공백으로 남겨두십시오."
                }
            }
        ]
    },

    // Polls Command
    COMMAND_POLL_NO_ARG: "투표하기 위한 선택지를 입력하거나, 명령(create/view/etc)을 입력하십시오.",
    COMMAND_POLL_ALREADY_RUNNING: "죄송합니다만 한번에 하나의 투표만 가능합니다. 현재 진행중인 투표를 먼저 종료하십시오.",
    COMMAND_POLL_MISSING_QUESTION: "무엇을 투표할지 지정하여야 합니다.",
    COMMAND_POLL_TOO_FEW_OPT: "투표할 선택지가 적어도 2개 이상이어야 합니다.",
    COMMAND_POLL_TOO_MANY_OPT: "투표할 선택지는 최대 10까지만 기능합니다.",
    COMMAND_POLL_CREATED: (name, prefix, poll) => `**${name}** 가 새로운 투표를 시작하였습니다:\n다음 명령으로 투표하십시오 \`${prefix}poll <choice>\`\n\n${poll}`,
    COMMAND_POLL_NO_POLL: "현재 진행중인 투표가 없습니다",
    COMMAND_POLL_FINAL: (poll) => `${poll}에 대한 최종 결과입니다`,
    COMMAND_POLL_FINAL_ERROR: (question) => `**${question}**를 지울 수가 없습니다. 다시 시도해보십시오.`,
    COMMAND_POLL_INVALID_OPTION: "적절한 옵션이 아닙니다",
    COMMAND_POLL_SAME_OPT: (opt) => `이미 **${opt}**를 선택하셨습니다`,
    COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `**${oldOpt}**에서 **${newOpt}**로 선택을 변경하셨습니다`,
    COMMAND_POLL_REGISTERED: (opt) => `**${opt}** 선택이 등록되었습니다`,
    COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice}: **${optCount} vote${optCount === 1 ? "" : "s"}**\n`,
    COMMAND_POLL_HELP: {
        description: "여러개의 선택지를 가진 투표를 시작합니다",
        actions: [
            {
                action: "Create",
                actionDesc: "새로운 투표를 시작합니다",
                usage: ";poll create <question> | <opt1> | <opt2> | [...] | [opt10]",
                args: {
                    "question": "결과를 얻고 싶은 질문.",
                    "opt": "사용자들이 선택할 수 있는 선택지"
                }
            },
            {
                action: "Vote",
                actionDesc: "원하는 선택지에 투표합니다",
                usage: ";poll <choice>",
                args: {
                    "choice": "당신이 고른 선택지"
                }
            },
            {
                action: "View",
                actionDesc: "현재 투표의 진행상황을 보여줍니다.",
                usage: ";poll view",
                args: {}
            },
            {
                action: "Close",
                actionDesc: "투표를 종료하고 최종 결과를 보여줍니다.",
                usage: ";poll close",
                args: {}
            }
        ]
    },

    // Raidteams Command
    COMMAND_RAIDTEAMS_INVALID_RAID: (prefix, help) => `잘못된 레이드 입니다. 사용법은 다음과 같습니다 \`${prefix}${help.usage}\`\n**예:** \`${prefix}${help.example}\``,
    COMMAND_RAIDTEAMS_INVALID_PHASE: (prefix, help) => `잘못된 페이즈 입니다. 사용법은 다음과 같습니다 \`${prefix}${help.usage}\`\n**예:** \`${prefix}${help.example}\``,
    COMMAND_RAIDTEAMS_PHASE_SOLO: "Solo",
    COMMAND_RAIDTEAMS_PHASE_ONE: "Phase 1",
    COMMAND_RAIDTEAMS_PHASE_TWO: "Phase 2",
    COMMAND_RAIDTEAMS_PHASE_THREE: "Phase 3",
    COMMAND_RAIDTEAMS_PHASE_FOUR: "Phase 4",
    COMMAND_RAIDTEAMS_CHARLIST: (charList) => `**캐릭터:** \`${charList}\``,
    COMMAND_RAIDTEAMS_SHOWING: (currentPhase) => `${currentPhase}에 사용되는 팀 목록`,
    COMMAND_RAIDTEAMS_NO_TEAMS: (currentPhase) => `\`${currentPhase}\`에 맞는 팀을 찾을 수 없습니다`,
    COMMAND_RAIDTEAMS_CODE_TEAMS: (raidName, currentPhase) => ` * ${raidName} * \n\n* ${currentPhase}에 사용되는 팀 목록\n\n`,
    COMMAND_RAIDTEAMS_CODE_TEAMCHARS: (raidTeam, charList) => `### ${raidTeam} ### \n* 캐릭터: ${charList}\n`,
    COMMAND_RAIDTEAMS_HELP: {
        description: "각 레이드에서 유용한 팀 목록을 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";raidteams <raid> <phase>",
                args: {
                    "raid": "유용한 팀 목록을 보고 싶은 레이드 이름. (aat|pit|sith)",
                    "phase": "레이드에서 유용한 팀 목록을 보고 싶은 페이즈. (p1|p2|p3|p4|solo)"
                }
            }
        ]
    },

    // Randomchar Command
    COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `죄송합니다만, 1-${maxChar} 까지의 숫자를 사용해주십시오.`,
    COMMAND_RANDOMCHAR_HELP: {
        description: "팀을 구성하기 위한 캐릭터를 랜덤하게 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";randomchar [numberOfChars]",
                args: {
                    "numberOfChars": "랜덤하게 보여줄 캐릭터의 숫자"
                }
            }
        ]
    },

    // Register Command
    COMMAND_REGISTER_MISSING_ARGS: "사용자 아이디와 동맹 코드가 필요합니다",
    COMMAND_REGISTER_MISSING_ALLY: "계정을 연동하려면 동맹 코드를 입력해야 합니다.",
    COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `죄송합니다만 ${allyCode} 는 유효한 동맹코드가 아닙니다`,
    COMMAND_REGISTER_PLEASE_WAIT: "계정 자료를 동기화 하는 동안 잠시 기다려주십시오.",
    COMMAND_REGISTER_FAILURE: "등록이 실패하였습니다. 동맹 코드가 맞는지 확인하여주십시오",
    COMMAND_REGISTER_SUCCESS: (user) => ` \`${user}\` 등록이 성공하였습니다!`,
    COMMAND_REGISTER_UPDATE_FAILURE: "문제가 생겼습니다. 동맹 코드가 맞는지 확인하여주십시오",
    COMMAND_REGISTER_UPDATE_SUCCESS: (user) => `\`${user}\`에 대한 프로파일이 갱신되었습니다.`,
    COMMAND_REGISTER_GUPDATE_SUCCESS: (guild) => `\`${guild}\`에 대하여 길드가 갱신되었습니다.`,
    COMMAND_REGISTER_HELP: {
        description: "사용자의 디스코드 아이디에 동맹 코드를 등록하고, SWGoH의 프로파일과 동기화합니다.",
        actions: [
            {
                action: "Add",
                actionDesc: "사용자의 디스코드 아이디에 SWGoH 계정을 등록합니다",
                usage: ";register add <user> <allyCode>",
                args: {
                    "user": "등록하고 싶은 사용자. (me | userID | mention)",
                    "allyCode": "게임 내에서 사용되는 동맹코드."
                }
            },
            {
                action: "Update",
                actionDesc: "사용자의 SWGoH 자료를 갱신하거나 재동기화 합니다.",
                usage: ";register update <user> [-guild]",
                args: {
                    "user": "연동하고 싶은 사용자. (me | userID | mention)",
                    "-guild": "사용자의 길드 전체 자료를 갱신 (-g | -guild | -guilds)"
                }
            },
            {
                action: "Remove",
                actionDesc: "디스코드 아이디와 SWGoH 계정의 연동을 해제합니다",
                usage: ";register remove <user>",
                args: {
                    "user": "계정 연동을 해제하려는 사용자. (me | userID | mention)"
                }
            }
        ]
    },



    // Reload Command
    COMMAND_RELOAD_INVALID_CMD: (cmd) => `명령어를 찾을 수 없습니다: ${cmd}`,
    COMMAND_RELOAD_SUCCESS: (cmd) => `명령어를 다시 읽어들이는데 성공하였습니다: ${cmd}`,
    COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `명령어를 다시 읽어들이는데 실패하였습니다: ${cmd}\n\`\`\`${stackTrace}\`\`\``,
    COMMAND_RELOAD_HELP: {
        description: "명령어 파일이 수정된 경우 다시 읽어들입니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";reload <command>",
                args: {
                    "command": "다시 읽어들이려는 명령어."
                }
            }
        ]
    },

    // Reload Data Command
    COMMAND_RELOADDATA_HELP: {
        description: "지정한 파일(들)을 다시 읽어들입니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";reloaddata <option>",
                args: {
                    "option": "다시 읽어들이고 싶은 내용 ( commands | data | events | function )."
                }
            }
        ]
    },

    // Setconf Command
    COMMAND_SETCONF_MISSING_PERMS: "죄송합니다만 관리자가 아니시거나, 서버 관리자가 적절한 설정을 하지 않은 상태입니다.",
    COMMAND_SETCONF_MISSING_OPTION: "바꾸고 싶은 설정의 옵션을 선택하셔야 합니다.",
    COMMAND_SETCONF_MISSING_VALUE: "옵션을 바꿀 설정 값을 지정하셔야 합니다.",
    COMMAND_SETCONF_ARRAY_MISSING_OPT: "`add`나 `remove` 명령을 사용하십시오.",
    COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `죄송합니다만 \`${value}\`는 \`${key}\`에 설정되지 않는 값입니다.`,
    COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${key}\`에 \`${value}\`가 ${action} 되었습니다.`,
    COMMAND_SETCONF_NO_KEY: (prefix) => `이 키는 설정되지 않았습니다. 다음 명령을 사용하여 목록을 살펴보시기 바랍니다 "${prefix}showconf" 또는 "${prefix}setconf help"`,
    COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `길드 설정 항목 ${key} 이(가) 다음으로 변경되었습니다:\n\`${value}\``,
    COMMAND_SETCONF_NO_SETTINGS: "길드 설정이 없습니다.",

    COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `${opt}에 역할을 설정해야 합니다 .`,
    COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `죄송합니다만 ${roleName} 역할을 찾지 못했습니다. 다시 시도해보십시오.`,
    COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `죄송합니다만 ${roleName} 역할이 이미 존재합니다.`,
    COMMAND_SETCONF_PREFIX_TOO_LONG: "죄송합니다만 접두사(prefix)에는 공백을 둘 수 없습니다",
    COMMAND_SETCONF_WELCOME_NEED_CHAN: "죄송합니다만 안내 채널이 설정되지 않았거나 더이상 유효하지 않습니다.\n`announceChan` 명령으로 유효한 채널을 설정한 후에 다시 시도하십시오.`",
    COMMAND_SETCONF_TIMEZONE_NEED_ZONE: "타임존이 잘못되었습니다, 다음 사이트를 확인하십시오 https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \n원하는 항목을 찾고, TZ 칼럼에 있는 내용을 입력하십시오",
    COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `죄송합니다만 ${chanName} 채널을 찾을 수 없습니다. 다시 시도해보십시오.`,
    COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: "죄송합니다만 해당 채널에 안내할 권한이 없습니다. 권한 설정을 변경하시거나 다른 채널을 선택하십시오.",
    COMMAND_SETCONF_INVALID_LANG: (value, langList) => `죄송합니다만 ${value} 은(는) 현재 지원되는 언어가 아닙니다. \n현재 지원되는 언어는 다음과 같습니다: \`${langList}\``,
    COMMAND_SETCONF_RESET: "설정이 초기화되었습니다",
    COMMAND_SETCONF_HELP: {
        description: "로봇을 설정하는데 사용됩니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";setconf <key> <value>",
                args: {}
            },
            {
                action: "prefix",
                actionDesc: "서버에서 사용할 로봇의 접두사(prefix)를 설정합니다.",
                usage: ";setconf prefix <prefix>",
                args: {}
            },
            {
                action: "adminRole",
                actionDesc: "로봇 설정을 변경하거나 이벤트 설정을 하기 위한 역할",
                usage: ";setconf adminRole <add|remove> <role>",
                args: {
                    "add":  "목록에 역할을 추가",
                    "remove": "목록에서 역할을 제거"
                }
            },
            {
                action: "enableWelcome",
                actionDesc: "환영 인사를 키거나 끕니다.",
                usage: ";setconf enableWelcome <true|false>",
                args: {}
            },
            {
                action: "welcomeMessage",
                actionDesc: "환영 인사말을 켰을 경우에 사용할 인사말",
                usage: ";setconf welcomeMessage <message>",
                args: {
                    "{{user}}":  "새로운 사용자의 이름",
                    "{{userMention}}": "새로운 사용자를 언급."
                }
            },
            {
                action: "enablePart",
                actionDesc: "서버 탈퇴 인사말을 키거나 끕니다.",
                usage: ";setconf enablePart <true|false>",
                args: {}
            },
            {
                action: "partMessage",
                actionDesc: "탈퇴 인사말을 켰을 때 사용할 인사말",
                usage: ";setconf partMessage <message>",
                args: {
                    "{{user}}":  "떠나는 사용자의 이름으로 변경됨",
                }
            },
            {
                action: "useEmbeds",
                actionDesc: "몇몇 명령어의 결과로 임베드(embed)를 사용할지 말지 결정.",
                usage: ";setconf useEmbeds <true|false>",
                args: {}
            },
            {
                action: "timezone",
                actionDesc: "시간 관련한 모든 명령어에 적용되는 타임존을 설정합니다. 타임존 목록이 필요한 경우 다음을 확인하십시오 https://goo.gl/Vqwe49.",
                usage: ";setconf timezone <timezone>",
                args: {}
            },
            {
                action: "announceChan",
                actionDesc: "이벤트 등에 사용할 안내 채널의 이름을 정합니다. 안내할 권한이 있는지 확인하십시오.",
                usage: ";setconf announceChan <channelName>",
                args: {}
            },
            {
                action: "useEventPages",
                actionDesc: "이벤트가 페이지 단위로 보이도록 합니다.",
                usage: ";setconf useEventPages <true|false>",
                args: {}
            },
            {
                action: "eventCountdown",
                actionDesc: "카운트다운이 표시되는 시간을 설정합니다",
                usage: ";setconf eventCountdown <add|remove> <time>",
                args: {
                    "add":  "지정한 시간을 목록에 추가",
                    "remove": "지정한 시간을 목록에서 제거"
                }
            },
            {
                action: "language",
                actionDesc: "명령어의 결과가 표시될 언어를 지정합니다.",
                usage: ";setconf language <lang>",
                args: {}
            },
            {
                action: "swgohLanguage",
                actionDesc: "게임 자료의 결과가 표시될 언어를 지정합니다.",
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
    COMMAND_SHARDTIMES_MISSING_USER: "사용자가 필요합니다. \"me\", 다른 사용자이름, 또는 디스코드 아이디를 입력하십시오.",
    COMMAND_SHARDTIMES_MISSING_ROLE: "관리자 권한이 없는 경우 본인만 추가할 수 있습니다.",
    COMMAND_SHARDTIMES_INVALID_USER: "잘못된 사용자입니다. \"me\", 다른 사용자이름, 또는 디스코드 아이디를 입력하십시오.",
    COMMAND_SHARDTIMES_MISSING_TIMEZONE: "'타임존 지정이 필요합니다'.",
    COMMAND_SHARDTIMES_INVALID_TIMEZONE: "잘못된 타임존입니다. 다음 사이트를 확인하십시오 https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \n원하는 항목을 찾고, TZ 칼럼에 있는 내용을 입력하십시오",
    COMMAND_SHARDTIMES_USER_ADDED: "사용자 추가에 성공하였습니다!",
    COMMAND_SHARDTIMES_USER_NOT_ADDED: "사용자 추가에 문제가 생겼습니다. 다시 시도해주십시오.",
    COMMAND_SHARDTIMES_REM_MISSING_PERMS: "관리자 권한이 없는 경우 본인만 삭제할 수 있습니다.",
    COMMAND_SHARDTIMES_REM_SUCCESS: "사용자 제거에 성공하였습니다!",
    COMMAND_SHARDTIMES_REM_FAIL: "사용자 제거에 문제가 생겼습니다. 다시 시도해주십시오.",
    COMMAND_SHARDTIMES_REM_MISSING: "죄송합니다만 지정한 사용자가 없습니다.",
    COMMAND_SHARDTIMES_SHARD_HEADER: "아레나 보상시간:",
    COMMAND_SHARDTIMES_HELP: {
        description: "등록된 사용자들의 보상시간 목록.",
        actions: [
            {
                action: "Add",
                actionDesc: "보상시간 추적기에 사용자를 추가",
                usage: ";shardtimes add <user> <timezone> [flag/emoji]",
                args: {
                    "user": "추가할 사용자 이름. (me | userID | mention)",
                    "timezone": "사용자의 타임존",
                    "flag/emoji": "사용자 이름과 같이 표시되는 그림문자"
                }
            },
            {
                action: "Remove",
                actionDesc: "보상시간 추적기에서 사용자를 제거",
                usage: ";shardtimes remove <user>",
                args: {
                    "user": "제거할 사용자 이름. (me | userID | mention)"
                }
            },
            {
                action: "View",
                actionDesc: "보상시간 추적기에 등록된 모든 사용자의 보상시간 목록",
                usage: ";shardtimes view",
                args: {}
            }
        ]
    },

    // Ships Command
    COMMAND_SHIPS_NEED_CHARACTER: (prefix) => `캐릭터나 함선 이름이 필요합니다. 사용법은 다음과 같습니다 \`${prefix}ship <ship|pilot>\``,
    COMMAND_SHIPS_INVALID_CHARACTER: (prefix) => `잘못된 이름입니다. 사용법은 다음과 같습니다 \`${prefix}ship <ship|pilot>\``,
    COMMAND_SHIPS_TOO_MANY: "검색 결과가 너무 많습니다. 검색어를 조금 더 자세히 지정해주십시오.",
    COMMAND_SHIPS_CREW: "승무원",
    COMMAND_SHIPS_FACTIONS: "팩션",
    COMMAND_SHIPS_ABILITIES: (abilities) => `**능력 종류:** ${abilities.type}   **능력 쿨다운:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
    COMMAND_SHIPS_CODE_ABILITES_HEADER: " * 능력 목록 *\n",
    COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\n능력 종류: ${abilities.type}   능력 쿨다운: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
    COMMAND_SHIPS_HELP: {
        description: "지정한 함선에 대한 정보를 보여줍니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: "ship <ship|pilot>",
                args: {
                    "ship|pilot": "정보를 보기 원하는 함선이나 파일럿."
                }
            }
        ]
    },

    // Showconf Command
    COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `${serverName}에 설정된 내용입니다: \`\`\`${configKeys}\`\`\``,
    COMMAND_SHOWCONF_HELP: {
        description: "서버 설정을 보여줍니다.",
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
    COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID) => `= 통계 (${shardID}) =\n
• Mem Usage  :: ${memUsage} MB
• CPU Load   :: ${cpuLoad}%
• Uptime     :: ${uptime}
• Users      :: ${users}
• Servers    :: ${servers}
• Channels   :: ${channels}
• Source     :: https://github.com/jmiln/SWGoHBot`,
    COMMAND_STATS_HELP: {
        description: "로봇의 상태를 보여줍니다.",
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
        description: "테스트를 위한 명령입니다.",
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
    COMMAND_TIME_CURRENT: (time, zone) => `현재 시간: ${time} 타임존 ${zone}`,
    COMMAND_TIME_INVALID_ZONE: (time, zone) => `잘못된 타임존입니다. 현재 시간은 길드 타임존 ${zone}에서 ${time} 입니다`,
    COMMAND_TIME_NO_ZONE: (time) => `현재 시간: ${time} UTC`,
    COMMAND_TIME_WITH_ZONE: (time, zone) => `현재시간: ${time} 타임존 ${zone}`,
    COMMAND_TIME_HELP: {
        description: "길드에 설정된 타임존에서 현재 시간을 확인합니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";time [timezone]",
                args: {
                    "timezone": "다른 지역의 시간을 알고 싶을 때 지정합니다"
                }
            }
        ]
    },

    // Updatechar Command
    COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `죄송합니다만 ${arg} 은(는) 유효한 항목이 아닙니다. 다음 목록 중 하나를 사용하십시오: ${usableArgs}`,
    COMMAND_UPDATECHAR_NEED_CHAR: "갱신 하려는 캐릭터를 지정해야 합니다.",
    COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `죄송합니다만 '${charName}'에 대한 검색 결과가 없습니다. 다시 시도해주십시오.`,
    COMMAND_UPDATECHAR_HELP: {
        description: "지정한 캐릭터에 대한 정보를 갱신합니다.",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";updatechar [gear|info|mods] [charater]",
                args: {
                    "gear": "캐릭터의 장비 정보 갱신.",
                    "info": "캐릭터에 대한 정보 갱신 (Image link, abilities etc.)",
                    "mods": "crouchingrancor.com으로부터 모드 자료 갱신"
                }
            }
        ]
    },

    // UpdateClient Command
    COMMAND_UPDATECLIENT_HELP: {
        description: "SWGoHAPI를 위한 클라이언트 갱신.",
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
    COMMAND_ZETA_NO_USER: "죄송합니다만 사용자를 찾을 수 없습니다.",
    COMMAND_ZETA_NO_ZETAS: "제타를 준 캐릭터가 없습니다.",
    COMMAND_ZETA_OUT_DESC: `\`${"-".repeat(30)}\`\n\`[L]\` 리더 | \`[S]\` 특별 | \`[U]\` 고유\n\`${"-".repeat(30)}\``,
    COMMAND_ZETAS_HELP: {
        description: "제타를 적용한 능력을 보여줍니다",
        actions: [
            {
                action: "",
                actionDesc: "",
                usage: ";zeta [user]",
                args: {
                    "user": "제타를 확인하려는 사용자. (me | userID | mention)"
                }
            }
        ]
    }
};
