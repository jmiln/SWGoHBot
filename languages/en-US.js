module.exports = {
    DAYSOFWEEK: {
        SUNDAY: {
            SHORT: 'sun',
            LONG: 'sunday'
        },
        MONDAY: {
            SHORT: 'mon',
            LONG: 'monday'
        },
        TUESDAY: {
            SHORT: 'tue',
            LONG: 'tuesday'
        },
        WEDNESDAY: {
            SHORT: 'wed',
            LONG: 'wednesday'
        },
        THURSDAY: {
            SHORT: 'thu',
            LONG: 'thursday'
        },
        FRIDAY: {
            SHORT: 'fri',
            LONG: 'friday'
        },
        SATURDAY: {
            SHORT: 'sat',
            LONG: 'saturday'
        }
    },

    TIMES: {
        DAY: {
            PLURAL: 'days',
            SING: 'day',
            SHORT_PLURAL: 'ds',
            SHORT_SING: 'd'
        },
        HOUR: {
            PLURAL: 'hours',
            SING: 'hour',
            SHORT_PLURAL: 'hrs',
            SHORT_SING: 'hr'
        },
        MINUTE: {
            PLURAL: 'minutes',
            SING: 'minute',
            SHORT_PLURAL: 'mins',
            SHORT_SING: 'min'
        },
        SECOND: {
            PLURAL: 'seconds',
            SING: 'second',
            SHORT_PLURAL: 'secs',
            SHORT_SING: 'sec'
        }
    },

    // Abilities Command 
    COMMAND_ABILITIES_NEED_CHARACTER: (prefix, usage) => `Need a character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_INVALID_CHARACTER: (prefix, usage) => `Invalid character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Ability Cooldown:** ${aCooldown}\n`,
    COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Ability Type:** ${aType}     **Max ability mat needed:** ${mat}\n${cdString}${aDesc}`,
    COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* Ability type: ${type}\n* Max ability mat needed: ${tier}\n* Description: ${aDesc}\n\n`,

    // Activities Command
    COMMAND_ACTIVITIES_SUNDAY: `== Before Reset == \nComplete Arena Battles \nSave Cantina Energy \nSave Normal Energy\n\n== After Reset == \nSpend Cantina Energy \nSave Normal Energy`,
    COMMAND_ACTIVITIES_MONDAY: `== Before Reset == \nSpend Cantina Energy \nSave Normal Energy \nSave Galactic War (unless reset available)\n\n== After Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War (unless reset available)`,
    COMMAND_ACTIVITIES_TUESDAY: `== Before Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War\n\n== After Reset == \nComplete Galactic War Battles \nSave Normal Energy`,
    COMMAND_ACTIVITIES_WEDNESDAY: `== Before Reset == \nComplete Galactic War Battles \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Hard Mode Battles`,
    COMMAND_ACTIVITIES_THURSDAY: `== Before Reset == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges\n\n== After Reset == \nComplete Challenges \nSave Normal Energy`,
    COMMAND_ACTIVITIES_FRIDAY: `== Before Reset == \nComplete Challenges \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Dark Side Battles`,
    COMMAND_ACTIVITIES_SATURDAY: `== Before Reset == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy\n\n== After Reset == \nComplete Arena Battles \nSave Cantina Energy`,
    COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Invalid day, usage is \`${prefix}${usage}\``,

    // Arenarank Command
    COMMAND_ARENARANK_INVALID_NUMBER: `You need to enter a valid rank number`,
    COMMAND_ARENARANK_BEST_RANK: `You've already gotten as far as you can, congrats!`,
    COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `From rank ${currentRank}, in ${battleCount} battle${plural} ${est}\nThe best you can get is ${rankList}`,

    // Challenges Command
    COMMAND_CHALLENGES_TRAINING: "Training Droids",
    COMMAND_CHALLENGES_ABILITY : "Ability Mats",
    COMMAND_CHALLENGES_BOUNTY  : "Bounty Hunter",  
    COMMAND_CHALLENGES_AGILITY : "Agility Gear",   
    COMMAND_CHALLENGES_STRENGTH: "Strength Gear",  
    COMMAND_CHALLENGES_TACTICS : "Tactics Gear",   
    COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "Ship Enhancement Droids",
    COMMAND_CHALLENGES_SHIP_BUILDING   : "Ship Building Materials",
    COMMAND_CHALLENGES_SHIP_ABILITY    : "Ship Ability Materials",
    COMMAND_CHALLENGES_MISSING_DAY: 'You need to specify a day',
    COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `Invalid date, usage is \`${prefix}${usage}\``,






};