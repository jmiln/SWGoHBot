process.env.TESTING_ENV = true;
const dataUpdater = require("../../services/dataUpdater.js");

const { describe, it } = require("node:test");
const assert = require("node:assert");

const gameData = {
    ability: [
        {
            triggerCondition: [],
            tier: [
                {
                    effectReference: [
                        { contextIndex: [], id: "basicability_arc170clonesergeant_damage_u01", maxBonusMove: 1 },
                        { contextIndex: [], id: "basicability_arc170clonesergeant_target_lock_BASE", maxBonusMove: 1 }
                    ],
                    interactsWithTag: [],
                    descKey: "BASICABILITY_ARC170CLONESERGEANT_TIER01_DESC",
                    upgradeDescKey: "ABILITYUPGRADE_STAT_DAMAGE05PCT_DESC",
                    cooldownMaxOverride: 0,
                    blockingEffectId: "",
                    blockedLocKey: ""
                },
            ],
            descriptiveTag: [],
            interactsWithTag: [],
            ultimateChargeRequired: [],
            id: "basicability_arc170clonesergeant",
            nameKey: "BASICABILITY_ARC170CLONESERGEANT_NAME",
            descKey: "BASICABILITY_ARC170CLONESERGEANT_DESC",
            prefabName: "prefab.ability_ship_laser_blue_atk",
            stackingLineOverride: "",
            cooldown: 0,
            icon: "tex.ability_arc170_clonesergeant_basic",
            applyTypeTooltipKey: "TOOLTIP_PHYSICAL",
            confirmationMessage: null,
            buttonLocation: 1,
            shortDescKey: "",
            abilityType: 7,
            detailLocation: 1,
            allyTargetingRuleId: "",
            useAsReinforcementDesc: false,
            subIcon: "icon_targetlock",
            cooldownType: 1,
            alwaysDisplayInBattleUi: false,
            highlightWhenReadyInBattleUi: false,
            hideCooldownDescription: false,
            blockingEffectId: "",
            blockedLocKey: "",
            grantedPriority: 0,
            synergy: null,
            visualTarget: null
        }
    ],
    skill: [
        {
            tier: [
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T1", requiredUnitLevel: 50, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T2", requiredUnitLevel: 60, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T3", requiredUnitLevel: 68, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T4", requiredUnitLevel: 73, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T5", requiredUnitLevel: 78, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T6", requiredUnitLevel: 84, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                },
                {
                    recipeId: "SHIPSKILLRECIPE_BASIC_T7", requiredUnitLevel: 85, requiredUnitRarity: 1, requiredUnitTier: 1, powerOverrideTag: "",
                    requiredUnitRelicTier: 1, isZetaTier: false, isOmicronTier: false
                }
            ],
            id: "basicskill_ARC170CLONESERGEANT",
            nameKey: "DEFENSE_UP_NAME_KEY",
            iconKey: "tex.consumable_bacta_salvaged",
            abilityReference: "basicability_arc170clonesergeant",
            skillType: 1,
            isZeta: false,
            omicronMode: 1
        }
    ],
    category: [
        { uiFilter: [ 1 ], id: "affiliation_badbatch", descKey: "CATEGORY_BADBATCH_DESC", visible: true },
        { uiFilter: [ 1 ], id: "affiliation_imperialremnant", descKey: "CATEGORY_IMPERIALREMNANT_DESC", visible: true },
        { uiFilter: [ 1 ], id: "affiliation_huttcartel", descKey: "CATEGORY_HUTTCARTEL_DESC", visible: true },
        { uiFilter: [ 1, 2 ], id: "role_attacker", descKey: "CATEGORY_ROLEATTACKER_DESC", visible: true },
        { uiFilter: [ 1, 2 ], id: "role_tank", descKey: "CATEGORY_ROLETANK_DESC", visible: true },
        { uiFilter: [ 1, 2 ], id: "role_support", descKey: "CATEGORY_ROLESUPPORT_DESC", visible: true },

    ],
    equipment: [
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi04" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M06", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi08" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi12" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi12" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01SP", campaignMapId: "M02", campaignNodeId: "SHP01", campaignNodeDifficulty: 4, campaignMissionId: "Mi02" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "001",
            nameKey: "EQUIPMENT_001_NAME",
            iconKey: "tex.equip_weaponmod",
            requiredLevel: 1,
            equipmentStat: {
                stat: [ { unitStatId: 6, statValueDecimal: "60000", unscaledDecimalValue: "600000000", uiDisplayOverrideValue: "-1", scalar: "0" } ]
            },
            recipeId: "",
            tier: 1,
            sellValue: { currency: 1, quantity: 10, bonusQuantity: 0 },
            mark: "Mk I",
            obtainableTime: "0",
            type: 1,
            requiredRarity: 8,
            findFlowDisabled: false
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M05", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi04" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi04" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M08", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01SP", campaignMapId: "M01", campaignNodeId: "SHP01", campaignNodeDifficulty: 4, campaignMissionId: "Mi01" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L20", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L30", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L40", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L50", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L60", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L70", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "FLASH", campaignNodeId: "FLASH_LUKE_01_L80", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "002",
            nameKey: "EQUIPMENT_002_NAME",
            iconKey: "tex.equip_armormod",
            requiredLevel: 2,
            equipmentStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "10000", unscaledDecimalValue: "100000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "10000", unscaledDecimalValue: "100000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "10000", unscaledDecimalValue: "100000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            recipeId: "",
            tier: 1,
            sellValue: { currency: 1, quantity: 20, bonusQuantity: 0 },
            mark: "Mk I",
            obtainableTime: "0",
            type: 1,
            requiredRarity: 8,
            findFlowDisabled: false
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi11" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi12" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi01" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi08" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi09" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi09" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi11" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "003",
            nameKey: "EQUIPMENT_003_NAME",
            iconKey: "tex.equip_electrobinoculars",
            requiredLevel: 2,
            equipmentStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "20000", unscaledDecimalValue: "200000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "20000", unscaledDecimalValue: "200000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "20000", unscaledDecimalValue: "200000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            recipeId: "",
            tier: 1,
            sellValue: { currency: 1, quantity: 20, bonusQuantity: 0 },
            mark: "Mk I",
            obtainableTime: "0",
            type: 1,
            requiredRarity: 8,
            findFlowDisabled: false
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M04", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi06" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M05", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi12" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M05", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi12" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M06", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi09" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "004",
            nameKey: "EQUIPMENT_004_NAME",
            iconKey: "tex.equip_holotargetlens",
            requiredLevel: 2,
            equipmentStat: {
                stat: [
                    { unitStatId: 5, statValueDecimal: "20000", unscaledDecimalValue: "200000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            recipeId: "",
            tier: 1,
            sellValue: { currency: 1, quantity: 20, bonusQuantity: 0 },
            mark: "Mk I",
            obtainableTime: "0",
            type: 1,
            requiredRarity: 8,
            findFlowDisabled: false
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M05", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 4, campaignMissionId: "Mi09" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi09" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "005",
            nameKey: "EQUIPMENT_005_NAME",
            iconKey: "tex.equip_securityscan",
            requiredLevel: 2,
            equipmentStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "30000", unscaledDecimalValue: "300000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            recipeId: "",
            tier: 1,
            sellValue: { currency: 1, quantity: 20, bonusQuantity: 0 },
            mark: "Mk I",
            obtainableTime: "0",
            type: 1,
            requiredRarity: 8,
            findFlowDisabled: false
        }
    ],
    material: [
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "unitshard_BOBAFETT",
            nameKey: "UNIT_BOBAFETT_NAME",
            descKey: "UNITSHARD_GENERIC_DESC",
            iconKey: "tex.charui_bobafett",
            sellValue: { currency: 16, quantity: 15, bonusQuantity: 0 },
            xpValue: 0,
            type: 3,
            rarity: 1,
            trainingCost: 0,
            trainingCostMaxLevel: 0,
            unitDefReference: "BOBAFETT:FOUR_STAR",
            tier: 1,
            obtainableTime: "0",
            recipeId: ""
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF03" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER04" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER01" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER03" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "unitshard_STORMTROOPER",
            nameKey: "UNIT_STORMTROOPER_NAME",
            descKey: "UNITSHARD_GENERIC_DESC",
            iconKey: "tex.charui_trooperstorm",
            sellValue: { currency: 16, quantity: 15, bonusQuantity: 0 },
            xpValue: 0,
            type: 3,
            rarity: 1,
            trainingCost: 0,
            trainingCostMaxLevel: 0,
            unitDefReference: "STORMTROOPER:THREE_STAR",
            tier: 1,
            obtainableTime: "0",
            recipeId: ""
        },
        {
            lookupMission: [],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "unitshard_STORMTROOPERSCOUT",
            nameKey: "UNIT_STORMTROOPERSCOUT_NAME",
            descKey: "UNITSHARD_GENERIC_DESC",
            iconKey: "tex.charui_trooperstormblackops",
            sellValue: { currency: 16, quantity: 30, bonusQuantity: 0 },
            xpValue: 0,
            type: 3,
            rarity: 1,
            trainingCost: 0,
            trainingCostMaxLevel: 0,
            unitDefReference: "STORMTROOPERSCOUT:ONE_STAR",
            tier: 1,
            obtainableTime: "0",
            recipeId: ""
        },
        {
            lookupMission: [],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "unitshard_OOMSECURITYBATTLEDROID",
            nameKey: "UNIT_OOMSECURITYBATTLEDROID_NAME",
            descKey: "UNITSHARD_GENERIC_DESC",
            iconKey: "tex.charui_b1security",
            sellValue: { currency: 16, quantity: 30, bonusQuantity: 0 },
            xpValue: 0,
            type: 3,
            rarity: 1,
            trainingCost: 0,
            trainingCostMaxLevel: 0,
            unitDefReference: "OOMSECURITYBATTLEDROID:ONE_STAR",
            tier: 1,
            obtainableTime: "0",
            recipeId: ""
        },
        {
            lookupMission: [
                { requirementId: [], missionIdentifier: { campaignId: "C01D", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_REBEL", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_REBEL", campaignNodeDifficulty: 4, campaignMissionId: "TIER03" } }
            ],
            raidLookup: [],
            actionLinkLookup: [],
            raidImmediateLookup: [],
            id: "unitshard_HOTHREBELSOLDIER",
            nameKey: "UNIT_HOTHREBELSOLDIER_NAME",
            descKey: "UNITSHARD_GENERIC_DESC",
            iconKey: "tex.charui_rebelhoth",
            sellValue: { currency: 16, quantity: 15, bonusQuantity: 0 },
            xpValue: 0,
            type: 3,
            rarity: 1,
            trainingCost: 0,
            trainingCostMaxLevel: 0,
            unitDefReference: "HOTHREBELSOLDIER:THREE_STAR",
            tier: 1,
            obtainableTime: "0",
            recipeId: ""
        }
    ],
    statMod: [
        {
            missionLookup: [
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi01" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "MODS", campaignNodeId: "SET_1", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } }
            ],
            raidLookup: [], actionLinkLookup: [], raidImmediateLookup: [], id: "111", slot: 2, setId: "1", rarity: 1, nameKey: "EMPTY", descKey: "NULL",
            levelTableId: "statmodlevelexperience_ONE_STAR_DEFAULT", promotionId: "", promotionRecipeId: "", tierUpRecipeTableId: "", overclockRecipeTableId: "", rerollCapTableId: ""
        },
        {
            missionLookup: [
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi02" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "MODS", campaignNodeId: "SET_1", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } }
            ],
            raidLookup: [], actionLinkLookup: [], raidImmediateLookup: [], id: "112", slot: 3, setId: "1", rarity: 1, nameKey: "EMPTY", descKey: "NULL",
            levelTableId: "statmodlevelexperience_ONE_STAR_DEFAULT", promotionId: "", promotionRecipeId: "", tierUpRecipeTableId: "", overclockRecipeTableId: "", rerollCapTableId: ""
        },
        {
            missionLookup: [
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "MODS", campaignNodeId: "SET_1", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } }
            ],
            raidLookup: [], actionLinkLookup: [], raidImmediateLookup: [], id: "113", slot: 4, setId: "1", rarity: 1, nameKey: "EMPTY", descKey: "NULL",
            levelTableId: "statmodlevelexperience_ONE_STAR_DEFAULT", promotionId: "", promotionRecipeId: "", tierUpRecipeTableId: "", overclockRecipeTableId: "", rerollCapTableId: ""
        },
        {
            missionLookup: [
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi04" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "MODS", campaignNodeId: "SET_1", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } }
            ],
            raidLookup: [], actionLinkLookup: [], raidImmediateLookup: [], id: "114", slot: 5, setId: "1", rarity: 1, nameKey: "EMPTY", descKey: "NULL",
            levelTableId: "statmodlevelexperience_ONE_STAR_DEFAULT", promotionId: "", promotionRecipeId: "", tierUpRecipeTableId: "", overclockRecipeTableId: "", rerollCapTableId: ""
        },
        {
            missionLookup: [
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" } },
                { requirementId: [], missionIdentifier: { campaignId: "C01MB", campaignMapId: "M01", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi07" } },
                { requirementId: [], missionIdentifier: { campaignId: "EVENTS", campaignMapId: "MODS", campaignNodeId: "SET_1", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" } }
            ],
            raidLookup: [], actionLinkLookup: [], raidImmediateLookup: [], id: "115", slot: 6, setId: "1", rarity: 1, nameKey: "EMPTY", descKey: "NULL",
            levelTableId: "statmodlevelexperience_ONE_STAR_DEFAULT", promotionId: "", promotionRecipeId: "", tierUpRecipeTableId: "", overclockRecipeTableId: "", rerollCapTableId: ""
        }
    ],
    recipe: [
        {
            ingredients: [
                { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 15, maxQuantity: 15, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false },
                { id: "GRIND", type: 3, minQuantity: 10000, maxQuantity: 10000, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false }
            ],
            id: "promotionrecipe_ONESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", result: null, type: 2, viewRequirement: null, unlockLevel: 0, craftRequirement: null
        },
        {
            ingredients: [
                { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 25, maxQuantity: 25, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false },
                { id: "GRIND", type: 3, minQuantity: 20000, maxQuantity: 20000, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false }
            ],
            id: "promotionrecipe_TWOSTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", result: null, type: 2, viewRequirement: null, unlockLevel: 0, craftRequirement: null
        },
        {
            ingredients: [
                { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 30, maxQuantity: 30, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false },
                { id: "GRIND", type: 3, minQuantity: 100000, maxQuantity: 100000, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false }
            ],
            id: "promotionrecipe_THREESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", result: null, type: 2, viewRequirement: null, unlockLevel: 0, craftRequirement: null
        },
        {
            ingredients: [
                { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 65, maxQuantity: 65, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false },
                { id: "GRIND", type: 3, minQuantity: 250000, maxQuantity: 250000, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false }
            ],
            id: "promotionrecipe_FOURSTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", result: null, type: 2, viewRequirement: null, unlockLevel: 0, craftRequirement: null
        },
        {
            ingredients: [
                { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 85, maxQuantity: 85, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false },
                { id: "GRIND", type: 3, minQuantity: 500000, maxQuantity: 500000, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false }
            ],
            id: "promotionrecipe_FIVESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", result: null, type: 2, viewRequirement: null, unlockLevel: 0, craftRequirement: null
        }
    ],
    units: [
        {
            categoryId: [ "selftag_badbatchecho", "alignment_light", "role_support", "affiliation_badbatch", "profession_clonetrooper", "profession_clonetrooper_ls", "affiliation_republic", "any_obtainable", "territory_geonosis_republic", "gac_riskymission" ],
            skillReference: [
                { skillId: "basicskill_BADBATCHECHO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_BADBATCHECHO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_BADBATCHECHO02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_BADBATCHECHO01", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }
            ],
            unitTier: [
                { equipmentSet: [ "007", "007", "003", "008", "011", "010" ], tier: 1, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "025", "030", "014", "018", "028", "032" ], tier: 2, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "034", "014", "028", "041", "069", "049" ], tier: 3, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "068", "022", "037", "068", "049", "082" ], tier: 4, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "089", "065", "070", "015", "040", "088" ], tier: 5, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "045", "041", "041", "047", "073", "090" ], tier: 6, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "102", "068", "070", "054", "083", "107" ], tier: 7, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "095", "054", "117", "103", "112", "111" ], tier: 8, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "071", "095", "172", "113", "114", "125" ], tier: 9, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "173", "117", "172", "083", "114", "144" ], tier: 10, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "117", "136", "146", "131", "137", "144" ], tier: 11, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "165", "162", "161", "168", "169", "G12Finisher_BADBATCHECHO_B" ], tier: 12, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "9999", "9999", "9999", "9999", "9999", "9999" ], tier: 13, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } }
            ],
            limitBreak: [],
            uniqueAbility: [],
            limitBreakRef: [
                { abilityId: "specialability_badbatchecho01", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "specialability_badbatchecho02", requiredTier: 2, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            uniqueAbilityRef: [
                { abilityId: "uniqueability_badbatchecho01", requiredTier: 4, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            crew: [],
            modRecommendation: [
                { recommendationSetId: "t1_to_t6_badbatchecho", unitTier: 1 },
                { recommendationSetId: "t7_and_up_badbatchecho", unitTier: 7 }
            ],
            effectIconPriorityOverride: [],
            summonStatTable: [],
            exampleSquad: [
                { unitDefId: [ "BADBATCHHUNTER", "BADBATCHECHO", "BADBATCHWRECKER", "BADBATCHTECH", "CT7567" ], descriptionKey: "", thumbnail: "", name: "", showRequirement: null, hideRequirement: null, actionLink: null, id: "" }
            ],
            id: "BADBATCHECHO:FOUR_STAR",
            unitPrefab: "unit.char_bb_echo_pre",
            thumbnailName: "tex.charui_bb_echo",
            nameKey: "UNIT_BADBATCHECHO_NAME",
            rarity: 4,
            maxRarity: 7,
            forceAlignment: 2,
            xpTableId: "standard-unit-xp-table",
            actionCountMin: 1,
            actionCountMax: 1,
            combatType: 1,
            descKey: "UNIT_BADBATCHECHO_DESC",
            threatLevel: 1,
            obtainable: true,
            baseId: "BADBATCHECHO",
            promotionRecipeReference: "promotionrecipe_FOURSTAR",
            statProgressionId: "stattable_BADBATCHECHO_FOURSTAR",
            trainingXpWorthBaseValueOverride: -1,
            maxLevelOverride: 85,
            trainingCostMultiplierOverride: -1,
            creationRecipeReference: "creationrecipe_BADBATCHECHO",
            basePower: 400,
            baseStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "180000", unscaledDecimalValue: "1800000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "160000", unscaledDecimalValue: "1600000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "250000", unscaledDecimalValue: "2500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 5, statValueDecimal: "1200000", unscaledDecimalValue: "12000000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 1, statValueDecimal: "1750000", unscaledDecimalValue: "17500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 6, statValueDecimal: "150000", unscaledDecimalValue: "1500000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            primaryStat: "",
            basicAttack: null,
            leaderAbility: null,
            basicAttackRef: { abilityId: "basicability_badbatchecho", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            leaderAbilityRef: null,
            primaryUnitStat: 4,
            obtainableTime: "0",
            commandCost: 0,
            crewContributionTableId: "",
            unitClass: 6,
            battlePortraitPrefab: "",
            battlePortraitNameKey: "",
            relicDefinition: {
                relicTierDefinitionId: [ "TAC_SUP_RELIC_TIER_05", "TAC_SUP_RELIC_TIER_06", "TAC_SUP_RELIC_TIER_07", "TAC_SUP_RELIC_TIER_08", "TAC_SUP_RELIC_TIER_01", "TAC_SUP_RELIC_TIER_02", "TAC_SUP_RELIC_TIER_03", "TAC_SUP_RELIC_TIER_04", "TAC_SUP_RELIC_TIER_09" ],
                upgradeTableId: "relic_promotion_table",
                alignmentColorOverride: "",
                texture: "tex.relic_item_bbecho",
                nameKey: "RELIC_ECHO_NAME"
            },
            capitalUnlockKey: "",
            legend: false,
            squadPositionPriority: 0,
            big: false,
            hideInTurnOrder: false,
            thumbImageTurnOrder: ""
        },
        {
            categoryId: [ "alignment_dark", "role_attacker", "role_leader", "profession_bountyhunter", "affiliation_huttcartel", "profession_scoundrel", "selftag_greedo", "any_obtainable", "territory_dark_platoon", "specialmission_bountyhunter", "non_viable_leader", "gac_shotfirst", "gac_revenge", "raid_krayt_dragon_allowed" ],
            skillReference: [
                { skillId: "basicskill_GREEDO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_GREEDO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_GREEDO02", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_GREEDO01", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "contractskill_GREEDO01", requiredTier: 8, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "leaderskill_GREEDO", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }
            ],
            unitTier: [
                { equipmentSet: [ "009", "003", "003", "008", "010", "010" ], tier: 1, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "014", "025", "028", "015", "020", "012" ], tier: 2, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "044", "040", "057", "054", "013", "058" ], tier: 3, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "024", "056", "068", "024", "073", "064" ], tier: 4, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "068", "068", "073", "082", "089", "093" ], tier: 5, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "089", "079", "086", "091", "091", "092" ], tier: 6, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "092", "101", "108", "110", "104", "113" ], tier: 7, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "101", "106", "113", "112", "112", "118" ], tier: 8, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "112", "113", "112", "117", "126", "116" ], tier: 9, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "122", "135", "131", "139", "109", "144" ], tier: 10, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "117", "138", "129", "139", "144", "142" ], tier: 11, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "165", "160", "158", "171", "170", "G12Finisher_GREEDO_A" ], tier: 12, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "9999", "9999", "9999", "9999", "9999", "9999" ], tier: 13, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } }
            ],
            limitBreak: [],
            uniqueAbility: [],
            limitBreakRef: [
                { abilityId: "specialability_greedo01", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "specialability_greedo02", requiredTier: 6, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            uniqueAbilityRef: [
                { abilityId: "uniqueability_greedo01", requiredTier: 2, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "contractability_greedo01", requiredTier: 8, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            crew: [],
            modRecommendation: [ { recommendationSetId: "t1_to_t6_greedo", unitTier: 1 }, { recommendationSetId: "t7_and_up_greedo", unitTier: 7 } ],
            effectIconPriorityOverride: [],
            summonStatTable: [],
            exampleSquad: [
                { unitDefId: [ "BOBAFETT", "GREEDO", "DENGAR", "IG88", "GREEFKARGA" ], descriptionKey: "", thumbnail: "", name: "", showRequirement: null, hideRequirement: null, actionLink: null, id: "" }
            ],
            id: "GREEDO:THREE_STAR",
            unitPrefab: "unit.char_greedo_pre",
            thumbnailName: "tex.charui_greedo",
            nameKey: "UNIT_GREEDO_NAME",
            rarity: 3,
            maxRarity: 7,
            forceAlignment: 3,
            xpTableId: "standard-unit-xp-table",
            actionCountMin: 1,
            actionCountMax: 1,
            combatType: 1,
            descKey: "UNIT_GREEDO_DESC",
            threatLevel: 1,
            obtainable: true,
            baseId: "GREEDO",
            promotionRecipeReference: "promotionrecipe_THREESTAR",
            statProgressionId: "stattable_GREEDO_THREESTAR",
            trainingXpWorthBaseValueOverride: -1,
            maxLevelOverride: 85,
            trainingCostMultiplierOverride: -1,
            creationRecipeReference: "creationrecipe_GREEDO",
            basePower: 300,
            baseStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "160000", unscaledDecimalValue: "1600000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "220000", unscaledDecimalValue: "2200000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "150000", unscaledDecimalValue: "1500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 5, statValueDecimal: "1000000", unscaledDecimalValue: "10000000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 1, statValueDecimal: "1630000", unscaledDecimalValue: "16300000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 6, statValueDecimal: "200000", unscaledDecimalValue: "2000000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            primaryStat: "",
            basicAttack: null,
            leaderAbility: null,
            basicAttackRef: { abilityId: "basicability_greedo", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            leaderAbilityRef: { abilityId: "leaderability_greedo", requiredTier: 4, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            primaryUnitStat: 3,
            obtainableTime: "0",
            commandCost: 0,
            crewContributionTableId: "",
            unitClass: 6,
            battlePortraitPrefab: "",
            battlePortraitNameKey: "",
            relicDefinition: {
                relicTierDefinitionId: [ "AGI_ATK_RELIC_TIER_01", "AGI_ATK_RELIC_TIER_08", "AGI_ATK_RELIC_TIER_09", "AGI_ATK_RELIC_TIER_06", "AGI_ATK_RELIC_TIER_07", "AGI_ATK_RELIC_TIER_04", "AGI_ATK_RELIC_TIER_05", "AGI_ATK_RELIC_TIER_02", "AGI_ATK_RELIC_TIER_03" ],
                upgradeTableId: "relic_promotion_table",
                alignmentColorOverride: "",
                texture: "tex.relic_pst_greedo",
                nameKey: "RELIC_DT12_HEAVY_BLASTER_PISTOL_NAME"
            },
            capitalUnlockKey: "",
            legend: false,
            squadPositionPriority: 0,
            big: false,
            hideInTurnOrder: false,
            thumbImageTurnOrder: ""
        },
        {
            categoryId: [ "alignment_dark", "role_attacker", "role_leader", "any_obtainable", "selftag_grandinquisitor", "territory_dark_platoon", "territory_tb3_darkside", "territory_tb3_hero", "affiliation_empire", "profession_inquisitorius", "unaligned_force_user", "ds_unaligned_force_user", "conq_hokey_religion" ],
            skillReference: [
                { skillId: "basicskill_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_GRANDINQUISITOR01", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_GRANDINQUISITOR02", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "leaderskill_GRANDINQUISITOR", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_GRANDINQUISITOR01", requiredTier: 8, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_INQUISITOR01_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }
            ],
            unitTier: [
                { equipmentSet: [ "001", "002", "003", "004", "004", "005" ], tier: 1, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "025", "021", "015", "028", "028", "025" ], tier: 2, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "043", "060", "050", "041", "047", "049" ], tier: 3, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "055", "058", "024", "055", "060", "074" ], tier: 4, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "093", "043", "086", "051", "084", "079" ], tier: 5, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "075", "055", "092", "092", "093", "097" ], tier: 6, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "089", "079", "106", "172", "100", "099" ], tier: 7, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "108", "117", "099", "112", "111", "117" ], tier: 8, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "172", "102", "079", "117", "106", "111" ], tier: 9, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "144", "172", "129", "173", "129", "144" ], tier: 10, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "109", "129", "146", "134", "144", "153" ], tier: 11, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "158", "160", "160", "166", "168", "G12Finisher_GRANDINQUISITOR_C" ], tier: 12, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "9999", "9999", "9999", "9999", "9999", "9999" ], tier: 13, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } }
            ],
            limitBreak: [],
            uniqueAbility: [],
            limitBreakRef: [
                { abilityId: "specialability_grandinquisitor01", requiredTier: 2, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "specialability_grandinquisitor02", requiredTier: 4, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            uniqueAbilityRef: [
                { abilityId: "uniqueability_grandinquisitor01", requiredTier: 8, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "uniqueability_inquisitorius01_grandinquisitor", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "hiddenability_purge", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "hiddenability_grandinquisitor", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            crew: [],
            modRecommendation: [ { recommendationSetId: "t1_to_t6_grandinquisitor", unitTier: 1 }, { recommendationSetId: "t7_and_up_grandinquisitor", unitTier: 7 } ],
            effectIconPriorityOverride: [],
            summonStatTable: [],
            exampleSquad: [
                { unitDefId: [ "GRANDINQUISITOR", "NINTHSISTER", "FIFTHBROTHER", "SEVENTHSISTER", "SECONDSISTER" ], descriptionKey: "", thumbnail: "", name: "", showRequirement: null, hideRequirement: null, actionLink: null, id: "" },
                { unitDefId: [ "GRANDINQUISITOR", "NINTHSISTER", "FIFTHBROTHER", "SEVENTHSISTER", "EIGHTHBROTHER" ], descriptionKey: "", thumbnail: "", name: "", showRequirement: null, hideRequirement: null, actionLink: null, id: "" }
            ],
            id: "GRANDINQUISITOR:SEVEN_STAR",
            unitPrefab: "unit.char_grandinquisitor_pre",
            thumbnailName: "tex.charui_grandinquisitor",
            nameKey: "UNIT_GRANDINQUISITOR_NAME",
            rarity: 7,
            maxRarity: 7,
            forceAlignment: 3,
            xpTableId: "standard-unit-xp-table",
            actionCountMin: 1,
            actionCountMax: 1,
            combatType: 1,
            descKey: "UNIT_GRANDINQUISITOR_DESC",
            threatLevel: 1,
            obtainable: true,
            baseId: "GRANDINQUISITOR",
            promotionRecipeReference: "",
            statProgressionId: "stattable_GRANDINQUISITOR_SEVENSTAR",
            trainingXpWorthBaseValueOverride: -1,
            maxLevelOverride: 85,
            trainingCostMultiplierOverride: -1,
            creationRecipeReference: "creationrecipe_GRANDINQUISITOR",
            basePower: 700,
            baseStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "230000", unscaledDecimalValue: "2300000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "130000", unscaledDecimalValue: "1300000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "160000", unscaledDecimalValue: "1600000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 5, statValueDecimal: "1050000", unscaledDecimalValue: "10500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 1, statValueDecimal: "1550000", unscaledDecimalValue: "15500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 6, statValueDecimal: "180000", unscaledDecimalValue: "1800000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            primaryStat: "",
            basicAttack: null,
            leaderAbility: null,
            basicAttackRef: { abilityId: "basicability_grandinquisitor", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            leaderAbilityRef: { abilityId: "leaderability_grandinquisitor", requiredTier: 6, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            primaryUnitStat: 2,
            obtainableTime: "0",
            commandCost: 0,
            crewContributionTableId: "",
            unitClass: 6,
            battlePortraitPrefab: "",
            battlePortraitNameKey: "",
            relicDefinition: { relicTierDefinitionId: [ "STR_ATK_RELIC_TIER_09", "STR_ATK_RELIC_TIER_08", "STR_ATK_RELIC_TIER_05", "STR_ATK_RELIC_TIER_04", "STR_ATK_RELIC_TIER_07", "STR_ATK_RELIC_TIER_06", "STR_ATK_RELIC_TIER_01", "STR_ATK_RELIC_TIER_03", "STR_ATK_RELIC_TIER_02" ], upgradeTableId: "relic_promotion_table", alignmentColorOverride: "", texture: "tex.relic_item_grandinquisitor", nameKey: "RELIC_GRANDINQUISITOR_NAME" },
            capitalUnlockKey: "",
            legend: false,
            squadPositionPriority: 0,
            big: false,
            hideInTurnOrder: false,
            thumbImageTurnOrder: ""
        },
        {
            categoryId: [ "alignment_light", "role_support", "species_droid", "affiliation_resistance", "selftag_bb8", "any_obtainable", "territory_light_platoon", "platoon_legendary_light", "platoon_legendary_restricted", "gac_droidpilot", "gc_light_droid", "gac_loyaldroid", "conq_nonsepdroid" ],
            skillReference: [
                { skillId: "basicskill_BB8", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_BB801", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "specialskill_BB802", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_BB801", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_BB802", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 }
            ],
            unitTier: [
                { equipmentSet: [ "001", "002", "003", "004", "008", "009" ], tier: 1, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "009", "014", "015", "028", "032", "033" ], tier: 2, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "014", "018", "028", "039", "069", "049" ], tier: 3, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "014", "039", "069", "070", "054", "072" ], tier: 4, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "018", "047", "049", "068", "082", "083" ], tier: 5, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "014", "039", "072", "089", "080", "096" ], tier: 6, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "024", "068", "067", "085", "100", "105" ], tier: 7, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "095", "101", "108", "112", "114", "111" ], tier: 8, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "117", "095", "096", "108", "125", "132" ], tier: 9, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "144", "126", "111", "117", "133", "125" ], tier: 10, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "130", "129", "129", "137", "144", "142" ], tier: 11, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "158", "161", "159", "168", "167", "G12Finisher_BB8_B" ], tier: 12, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } },
                { equipmentSet: [ "9999", "9999", "9999", "9999", "9999", "9999" ], tier: 13, baseStat: { stat: [ [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object], [Object] ] } }
            ],
            limitBreak: [],
            uniqueAbility: [],
            limitBreakRef: [
                { abilityId: "specialability_bb801", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "specialability_bb802", requiredTier: 2, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            uniqueAbilityRef: [
                { abilityId: "uniqueability_bb801", requiredTier: 4, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "uniqueability_bb802", requiredTier: 6, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "handlerability_bb8", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "handlerability_bb8_droids", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            crew: [],
            modRecommendation: [ { recommendationSetId: "t1_to_t6_bb_8", unitTier: 1 }, { recommendationSetId: "t7_and_up_bb_8", unitTier: 7 } ],
            effectIconPriorityOverride: [],
            summonStatTable: [],
            exampleSquad: [ { unitDefId: [ "REYJEDITRAINING", "BB8", "FINN", "RESISTANCETROOPER", "REY" ], descriptionKey: "", thumbnail: "", name: "", showRequirement: null, hideRequirement: null, actionLink: null, id: "" } ],
            id: "BB8:FIVE_STAR",
            unitPrefab: "unit.char_bb8_pre",
            thumbnailName: "tex.charui_bb8",
            nameKey: "UNIT_BB8_NAME",
            rarity: 5,
            maxRarity: 7,
            forceAlignment: 2,
            xpTableId: "standard-unit-xp-table",
            actionCountMin: 1,
            actionCountMax: 1,
            combatType: 1,
            descKey: "UNIT_BB8_DESC",
            threatLevel: 1,
            obtainable: true,
            baseId: "BB8",
            promotionRecipeReference: "promotionrecipe_FIVESTAR",
            statProgressionId: "stattable_BB8_FIVESTAR",
            trainingXpWorthBaseValueOverride: -1,
            maxLevelOverride: 85,
            trainingCostMultiplierOverride: -1,
            creationRecipeReference: "creationrecipe_BB8",
            basePower: 500,
            baseStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "140000", unscaledDecimalValue: "1400000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "160000", unscaledDecimalValue: "1600000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "240000", unscaledDecimalValue: "2400000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 5, statValueDecimal: "1200000", unscaledDecimalValue: "12000000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 1, statValueDecimal: "1750000", unscaledDecimalValue: "17500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 6, statValueDecimal: "130000", unscaledDecimalValue: "1300000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            primaryStat: "",
            basicAttack: null,
            leaderAbility: null,
            basicAttackRef: { abilityId: "basicability_bb8", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            leaderAbilityRef: null,
            primaryUnitStat: 4,
            obtainableTime: "0",
            commandCost: 0,
            crewContributionTableId: "",
            unitClass: 6,
            battlePortraitPrefab: "",
            battlePortraitNameKey: "",
            relicDefinition: { relicTierDefinitionId: [ "TAC_SUP_RELIC_TIER_05", "TAC_SUP_RELIC_TIER_06", "TAC_SUP_RELIC_TIER_07", "TAC_SUP_RELIC_TIER_08", "TAC_SUP_RELIC_TIER_01", "TAC_SUP_RELIC_TIER_02", "TAC_SUP_RELIC_TIER_03", "TAC_SUP_RELIC_TIER_04", "TAC_SUP_RELIC_TIER_09" ], upgradeTableId: "relic_promotion_table", alignmentColorOverride: "", texture: "tex.relic_pst_bb8", nameKey: "RELIC_WELDING_TORCH_TOOLBAY_DISK_NAME" },
            capitalUnlockKey: "",
            legend: false,
            squadPositionPriority: 0,
            big: false,
            hideInTurnOrder: false,
            thumbImageTurnOrder: ""
        },
        {
            categoryId: [ "alignment_dark", "role_attacker", "territory_ship_platoon", "affiliation_separatist", "species_geonosian", "selftag_geonosianstarfighter2", "any_obtainable" ],
            skillReference: [
                { skillId: "basicskill_GEONOSIANSTARFIGHTER2", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "hardwareskill_GEONOSIANSTARFIGHTER201", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                { skillId: "uniqueskill_GEONOSIANSTARFIGHTER201", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }
            ],
            unitTier: [],
            limitBreak: [],
            uniqueAbility: [],
            limitBreakRef: [
                { abilityId: "specialability_geonosianstarfighter201", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            uniqueAbilityRef: [
                { abilityId: "uniqueability_geonosianstarfighter201", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "hardwareability_passive_geonosianstarfighter201", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
                { abilityId: "DO_NOT_UNATTACH_THIS_ABILITY_uniqueability_ship_portrait_properties", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" }
            ],
            crew: [
                { skillReference: [ { skillId: "specialskill_GEONOSIANSTARFIGHTER201", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ], unitId: "GEONOSIANSOLDIER", slot: 0, skilllessCrewAbilityId: "" }
            ],
            modRecommendation: [],
            effectIconPriorityOverride: [],
            summonStatTable: [],
            exampleSquad: [],
            id: "GEONOSIANSTARFIGHTER2:FIVE_STAR",
            unitPrefab: "unit.ship_geonosis_fighter_soldier_pre",
            thumbnailName: "tex.charui_geonosis_fighter_soldier",
            nameKey: "UNIT_GEONOSIANSTARFIGHTER2_NAME",
            rarity: 5,
            maxRarity: 7,
            forceAlignment: 3,
            xpTableId: "standard-ship-xp-table",
            actionCountMin: 1,
            actionCountMax: 1,
            combatType: 2,
            descKey: "UNIT_GEONOSIANSTARFIGHTER2_DESC",
            threatLevel: 1,
            obtainable: true,
            baseId: "GEONOSIANSTARFIGHTER2",
            promotionRecipeReference: "shippromotionrecipe_FIVESTAR",
            statProgressionId: "stattable_SHIP_STRENGTH_ATTACKER_FIVESTAR",
            trainingXpWorthBaseValueOverride: -1,
            maxLevelOverride: 85,
            trainingCostMultiplierOverride: -1,
            creationRecipeReference: "creationrecipe_GEONOSIANSTARFIGHTER2",
            basePower: 500,
            baseStat: {
                stat: [
                    { unitStatId: 2, statValueDecimal: "4690000", unscaledDecimalValue: "46900000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 3, statValueDecimal: "3750000", unscaledDecimalValue: "37500000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 4, statValueDecimal: "2810000", unscaledDecimalValue: "28100000000", uiDisplayOverrideValue: "-1", scalar: "0" },
                    { unitStatId: 5, statValueDecimal: "870000", unscaledDecimalValue: "8700000000", uiDisplayOverrideValue: "-1", scalar: "0" }
                ]
            },
            primaryStat: "",
            basicAttack: null,
            leaderAbility: null,
            basicAttackRef: { abilityId: "basicability_geonosianstarfighter2", requiredTier: 1, requiredRarity: 1, requiredSkillTier: -1, requiredRelicTier: 1, overrideAlwaysDisplayInBattleUi: false, overrideIcon: "", overrideNameKey: "", overrideDescKey: "", powerAdditiveTag: "", unlockRecipeId: "", inheritMappingId: "" },
            leaderAbilityRef: null,
            primaryUnitStat: 2,
            obtainableTime: "0",
            commandCost: 0,
            crewContributionTableId: "stattable_GEONOSIANSTARFIGHTER2",
            unitClass: 6,
            battlePortraitPrefab: "prefab.crewportrait_geonosiansoldier_pre",
            battlePortraitNameKey: "UNIT_GEONOSIANSOLDIER_NAME",
            relicDefinition: null,
            capitalUnlockKey: "",
            legend: false,
            squadPositionPriority: 0,
            big: false,
            hideInTurnOrder: false,
            thumbImageTurnOrder: ""
        }
    ],
};

const formattedUnits = [
    {
        baseId: "GRANDINQUISITOR",
        nameKey: "UNIT_GRANDINQUISITOR_NAME",
        skillReferenceList: [ { skillId: "basicskill_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR01", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR02", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "leaderskill_GRANDINQUISITOR", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_GRANDINQUISITOR01", requiredTier: 8, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_INQUISITOR01_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ],
        categoryIdList: [ "alignment_dark", "role_attacker", "role_leader", "any_obtainable", "selftag_grandinquisitor", "territory_dark_platoon", "territory_tb3_darkside", "territory_tb3_hero", "affiliation_empire", "profession_inquisitorius", "unaligned_force_user", "ds_unaligned_force_user", "conq_hokey_religion" ],
        combatType: 1,
        unitTierList: [
            { tier: 1, equipmentSetList: [ "001", "002", "003", "004", "004", "005" ] },
            { tier: 2, equipmentSetList: [ "025", "021", "015", "028", "028", "025" ] },
            { tier: 3, equipmentSetList: [ "043", "060", "050", "041", "047", "049" ] },
            { tier: 4, equipmentSetList: [ "055", "058", "024", "055", "060", "074" ] },
            { tier: 5, equipmentSetList: [ "093", "043", "086", "051", "084", "079" ] },
            { tier: 6, equipmentSetList: [ "075", "055", "092", "092", "093", "097" ] },
            { tier: 7, equipmentSetList: [ "089", "079", "106", "172", "100", "099" ] },
            { tier: 8, equipmentSetList: [ "108", "117", "099", "112", "111", "117" ] },
            { tier: 9, equipmentSetList: [ "172", "102", "079", "117", "106", "111" ] },
            { tier: 10, equipmentSetList: [ "144", "172", "129", "173", "129", "144" ] },
            { tier: 11, equipmentSetList: [ "109", "129", "146", "134", "144", "153" ] },
            { tier: 12, equipmentSetList: [ "158", "160", "160", "166", "168", "G12Finisher_GRANDINQUISITOR_C" ] },
            { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
        ],
        crewList: [],
        creationRecipeReference: "creationrecipe_GRANDINQUISITOR",
        legend: false
    },
    {
        baseId: "EMPERORSSHUTTLE",
        nameKey: "UNIT_EMPERORSSHUTTLE_NAME",
        skillReferenceList: [ { skillId: "basicskill_emperorsshuttle", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "hardwareskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ],
        categoryIdList: [ "alignment_dark", "role_support", "affiliation_empire", "profession_sith", "selftag_emperorsshuttle", "any_obtainable", "gac_wantthemalive" ],
        combatType: 2,
        unitTierList: [],
        crewList: [
            { skillReference: [ { skillId: "specialskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ], unitId: "EMPERORPALPATINE", slot: 0, skilllessCrewAbilityId: "" },
            { skillReference: [ { skillId: "specialskill_emperorsshuttle02", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ], unitId: "ROYALGUARD", slot: 1, skilllessCrewAbilityId: "" }
        ],
        creationRecipeReference: "creationrecipe_EMPERORSSHUTTLE",
        legend: false
    },
    {
        baseId: "BADBATCHECHO",
        nameKey: "UNIT_BADBATCHECHO_NAME",
        skillReferenceList: [ { skillId: "basicskill_BADBATCHECHO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_BADBATCHECHO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_BADBATCHECHO02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_BADBATCHECHO01", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 } ],
        categoryIdList: [ "selftag_badbatchecho", "alignment_light", "role_support", "affiliation_badbatch", "profession_clonetrooper", "profession_clonetrooper_ls", "affiliation_republic", "any_obtainable", "territory_geonosis_republic", "gac_riskymission" ],
        combatType: 1,
        unitTierList: [
            { tier: 1, equipmentSetList: [ "007", "007", "003", "008", "011", "010" ] },
            { tier: 2, equipmentSetList: [ "025", "030", "014", "018", "028", "032" ] },
            { tier: 3, equipmentSetList: [ "034", "014", "028", "041", "069", "049" ] },
            { tier: 4, equipmentSetList: [ "068", "022", "037", "068", "049", "082" ] },
            { tier: 5, equipmentSetList: [ "089", "065", "070", "015", "040", "088" ] },
            { tier: 6, equipmentSetList: [ "045", "041", "041", "047", "073", "090" ] },
            { tier: 7, equipmentSetList: [ "102", "068", "070", "054", "083", "107" ] },
            { tier: 8, equipmentSetList: [ "095", "054", "117", "103", "112", "111" ] },
            { tier: 9, equipmentSetList: [ "071", "095", "172", "113", "114", "125" ] },
            { tier: 10, equipmentSetList: [ "173", "117", "172", "083", "114", "144" ] },
            { tier: 11, equipmentSetList: [ "117", "136", "146", "131", "137", "144" ] },
            { tier: 12, equipmentSetList: [ "165", "162", "161", "168", "169", "G12Finisher_BADBATCHECHO_B" ] },
            { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
        ],
        crewList: [],
        creationRecipeReference: "creationrecipe_BADBATCHECHO",
        legend: false
    },
    {
        baseId: "QUIGONJINN",
        nameKey: "UNIT_QUIGONJINN_NAME",
        skillReferenceList: [
            { skillId: "specialskill_QUIGONJINN01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "specialskill_QUIGONJINN02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "basicskill_QUIGONJINN", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "leaderskill_QUIGONJINN", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }
        ],
        categoryIdList: [ "alignment_light", "role_support", "role_leader", "territory_light_platoon", "affiliation_republic", "profession_jedi", "longitudinally_implemented", "selftag_quigonjinn", "any_obtainable", "affiliation_galactic_republic_jedi", "non_viable_leader", "gac_succession", "gac_handlethis", "gac_dontlookback", "conq_hokey_religion" ],
        combatType: 1,
        unitTierList: [
            { tier: 1, equipmentSetList: [ "001", "004", "009", "009", "003", "011" ] },
            { tier: 2, equipmentSetList: [ "009", "020", "015", "028", "014", "032" ] },
            { tier: 3, equipmentSetList: [ "054", "059", "041", "041", "033", "060" ] },
            { tier: 4, equipmentSetList: [ "067", "068", "068", "049", "077", "047" ] },
            { tier: 5, equipmentSetList: [ "089", "072", "024", "083", "093", "073" ] },
            { tier: 6, equipmentSetList: [ "098", "095", "091", "089", "085", "088" ] },
            { tier: 7, equipmentSetList: [ "105", "109", "092", "095", "095", "103" ] },
            { tier: 8, equipmentSetList: [ "111", "112", "109", "098", "072", "080" ] },
            { tier: 9, equipmentSetList: [ "122", "125", "103", "098", "105", "095" ] },
            { tier: 10, equipmentSetList: [ "132", "125", "105", "098", "088", "080" ] },
            { tier: 11, equipmentSetList: [ "136", "136", "145", "140", "137", "150" ] },
            { tier: 12, equipmentSetList: [ "158", "165", "163", "169", "169", "G12Finisher_QUIGONJINN_C" ] },
            { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
        ],
        crewList: [],
        creationRecipeReference: "creationrecipe_QUIGONJINN",
        legend: false
    },
    {
        baseId: "ROSETICO",
        nameKey: "UNIT_ROSETICO_NAME",
        skillReferenceList: [
            { skillId: "basicskill_ROSETICO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "specialskill_ROSETICO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "specialskill_ROSETICO02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 },
            { skillId: "uniqueskill_ROSETICO01", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }
        ],
        categoryIdList: [ "alignment_light", "role_attacker", "affiliation_resistance", "selftag_rosetico", "any_obtainable", "territory_light_platoon" ],
        combatType: 1,
        unitTierList: [
            { tier: 1, equipmentSetList: [ "002", "006", "003", "011", "010", "001" ] },
            { tier: 2, equipmentSetList: [ "017", "018", "015", "019", "032", "034" ] },
            { tier: 3, equipmentSetList: [ "041", "053", "060", "048", "043", "047" ] },
            { tier: 4, equipmentSetList: [ "073", "055", "056", "078", "058", "051" ] },
            { tier: 5, equipmentSetList: [ "088", "089", "102", "075", "049", "077" ] },
            { tier: 6, equipmentSetList: [ "089", "079", "091", "088", "078", "072" ] },
            { tier: 7, equipmentSetList: [ "113", "110", "097", "088", "108", "068" ] },
            { tier: 8, equipmentSetList: [ "118", "089", "113", "090", "112", "084" ] },
            { tier: 9, equipmentSetList: [ "125", "115", "113", "109", "103", "080" ] },
            { tier: 10, equipmentSetList: [ "126", "129", "131", "117", "113", "129" ] },
            { tier: 11, equipmentSetList: [ "143", "134", "129", "138", "117", "129" ] },
            { tier: 12, equipmentSetList: [ "160", "159", "164", "168", "170", "G12Finisher_ROSETICO_A" ] },
            { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
        ],
        crewList: [],
        creationRecipeReference: "creationrecipe_ROSETICO",
        legend: false
    }
];


describe("processAbilities", () => {
    const { abilitiesOut, skillMap } = dataUpdater.processAbilities(gameData.ability, gameData.skill);
    it("should return both abilitiesOut and the skillMap", () => {
        assert.deepStrictEqual({ abilitiesOut, skillMap }, {
            "abilitiesOut": [
                {
                    "abilityTiers": [
                        "BASICABILITY_ARC170CLONESERGEANT_TIER01_DESC",
                    ],
                    "cooldown": 0,
                    "descKey": "BASICABILITY_ARC170CLONESERGEANT_TIER01_DESC",
                    "id": "basicability_arc170clonesergeant",
                    "isOmicron": false,
                    "isZeta": false,
                    "nameKey": "BASICABILITY_ARC170CLONESERGEANT_NAME",
                    "omicronTier": null,
                    "skillId": "basicskill_ARC170CLONESERGEANT",
                    "tierList": [
                        "SHIPSKILLRECIPE_BASIC_T1",
                        "SHIPSKILLRECIPE_BASIC_T2",
                        "SHIPSKILLRECIPE_BASIC_T3",
                        "SHIPSKILLRECIPE_BASIC_T4",
                        "SHIPSKILLRECIPE_BASIC_T5",
                        "SHIPSKILLRECIPE_BASIC_T6",
                        "SHIPSKILLRECIPE_BASIC_T7",
                    ],
                    "type": undefined,
                    "zetaTier": null,
                },
            ],
            "skillMap": {
                "basicskill_ARC170CLONESERGEANT": {
                    "abilityId": "basicability_arc170clonesergeant",
                    "isZeta": false,
                    "nameKey": "BASICABILITY_ARC170CLONESERGEANT_NAME",
                    "tiers": 7,
                },
            },
        });
    });
});

describe("processCategories", () => {
    it("should return the categories mapped to just an id and a descKey", () => {
        assert.deepStrictEqual(dataUpdater.processCategories(gameData.category), [
            { id: "affiliation_badbatch", descKey: "CATEGORY_BADBATCH_DESC" },
            { id: "affiliation_imperialremnant", descKey: "CATEGORY_IMPERIALREMNANT_DESC" },
            { id: "affiliation_huttcartel", descKey: "CATEGORY_HUTTCARTEL_DESC" },
            { id: "role_attacker", descKey: "CATEGORY_ROLEATTACKER_DESC" },
            { id: "role_tank", descKey: "CATEGORY_ROLETANK_DESC" },
            { id: "role_support", descKey: "CATEGORY_ROLESUPPORT_DESC" }
        ]);
    });
});

describe("processEquipment", () => {
    it("should return the equipment mapped down to just an id, nameKey, recipeId if available, and the mark", () => {
        assert.deepStrictEqual(dataUpdater.processEquipment(gameData.equipment), [
            { id: "001", nameKey: "EQUIPMENT_001_NAME", recipeId: "", mark: "Mk I" },
            { id: "002", nameKey: "EQUIPMENT_002_NAME", recipeId: "", mark: "Mk I" },
            { id: "003", nameKey: "EQUIPMENT_003_NAME", recipeId: "", mark: "Mk I" },
            { id: "004", nameKey: "EQUIPMENT_004_NAME", recipeId: "", mark: "Mk I" },
            { id: "005", nameKey: "EQUIPMENT_005_NAME", recipeId: "", mark: "Mk I" }
        ]);
    });
});

describe("processMaterials", () => {
    const { bulkMatArr } = dataUpdater.processMaterials(gameData.material);
    it("should return the materials mapped down to a bunch of mongodb requests to bulkWrite them", () => {
        assert.deepStrictEqual(bulkMatArr, [
            {
                updateOne: {
                    filter: { id: "unitshard_BOBAFETT" },
                    update: { "$set": { id: "unitshard_BOBAFETT", lookupMissionList: [ { campaignId: "C01D", campaignMapId: "M02", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" } ], raidLookupList: [], iconKey: "tex.charui_bobafett" } },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { id: "unitshard_STORMTROOPER" },
                    update: { "$set": { id: "unitshard_STORMTROOPER", lookupMissionList: [ { campaignId: "C01L", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi05" }, { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF01" }, { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF02" }, { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "DIFF03" }, { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER04" }, { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER01" }, { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" }, { campaignId: "EVENTS", campaignMapId: "BASICTRAINING", campaignNodeId: "BASIC_TRAINING_PROGRESSION_EMPIRE", campaignNodeDifficulty: 4, campaignMissionId: "TIER03" } ], raidLookupList: [], iconKey: "tex.charui_trooperstorm" } },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { id: "unitshard_STORMTROOPERSCOUT" },
                    update: { "$set": { id: "unitshard_STORMTROOPERSCOUT", lookupMissionList: [], raidLookupList: [], iconKey: "tex.charui_trooperstormblackops" } },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { id: "unitshard_OOMSECURITYBATTLEDROID" },
                    update: { "$set": { id: "unitshard_OOMSECURITYBATTLEDROID", lookupMissionList: [], raidLookupList: [], iconKey: "tex.charui_b1security" } },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { id: "unitshard_HOTHREBELSOLDIER" },
                    update: { "$set": { id: "unitshard_HOTHREBELSOLDIER", lookupMissionList: [ { campaignId: "C01D", campaignMapId: "M03", campaignNodeId: "N01", campaignNodeDifficulty: 5, campaignMissionId: "Mi03" }, { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_REBEL", campaignNodeDifficulty: 4, campaignMissionId: "TIER02" }, { campaignId: "EVENTS", campaignMapId: "SCHEDULED", campaignNodeId: "NODE_EVENT_ASSAULT_REBEL", campaignNodeDifficulty: 4, campaignMissionId: "TIER03" } ], raidLookupList: [], iconKey: "tex.charui_rebelhoth" } },
                    upsert: true
                }
            }

        ]);
    });
});

describe("processModData", () => {
    it("should format the mod data down to just the bits we'll actually use", () => {
        assert.deepStrictEqual(dataUpdater.processModData(gameData.statMod), {
            "111": { pips: 1, set: "1", slot: 2 },
            "112": { pips: 1, set: "1", slot: 3 },
            "113": { pips: 1, set: "1", slot: 4 },
            "114": { pips: 1, set: "1", slot: 5 },
            "115": { pips: 1, set: "1", slot: 6 }
        });
    });
});

describe("processRecipes", () => {
    const {mappedRecipeList} = dataUpdater.processRecipes(gameData.recipe);
    it("should format the recipe data down to just the bits we'll actually use", () => {
        assert.deepStrictEqual(mappedRecipeList, [
            { id: "promotionrecipe_ONESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", ingredients: [ { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 15, maxQuantity: 15, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false } ] },
            { id: "promotionrecipe_TWOSTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", ingredients: [ { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 25, maxQuantity: 25, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false } ] },
            { id: "promotionrecipe_THREESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", ingredients: [ { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 30, maxQuantity: 30, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false } ] },
            { id: "promotionrecipe_FOURSTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", ingredients: [ { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 65, maxQuantity: 65, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false } ] },
            { id: "promotionrecipe_FIVESTAR", descKey: "CREATIONRECIPE_GENERIC_DESC", ingredients: [ { id: "UNIT_SHARD_MATERIAL", type: 7, minQuantity: 85, maxQuantity: 85, rarity: 8, statMod: null, previewPriority: 0, unitLevel: 0, unitTier: 0, primaryReward: false } ] }
        ]);
    });

});

describe("processUnits", () => {
    const unitsOut = dataUpdater.processUnits(gameData.units);
    it("should only return one formatted unit, since the rest don't meet the requirements", () => {
        assert.strictEqual(unitsOut.length, 1);
    });
    it("should format the unit data down to just the bits we'll actually use", () => {
        assert.deepStrictEqual(unitsOut, [
            {
                baseId: "GRANDINQUISITOR",
                nameKey: "UNIT_GRANDINQUISITOR_NAME",
                skillReferenceList: [ { skillId: "basicskill_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR01", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR02", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "leaderskill_GRANDINQUISITOR", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_GRANDINQUISITOR01", requiredTier: 8, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_INQUISITOR01_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ],
                categoryIdList: [ "alignment_dark", "role_attacker", "role_leader", "any_obtainable", "selftag_grandinquisitor", "territory_dark_platoon", "territory_tb3_darkside", "territory_tb3_hero", "affiliation_empire", "profession_inquisitorius", "unaligned_force_user", "ds_unaligned_force_user", "conq_hokey_religion" ],
                combatType: 1,
                unitTierList: [
                    { tier: 1, equipmentSetList: [ "001", "002", "003", "004", "004", "005" ] },
                    { tier: 2, equipmentSetList: [ "025", "021", "015", "028", "028", "025" ] },
                    { tier: 3, equipmentSetList: [ "043", "060", "050", "041", "047", "049" ] },
                    { tier: 4, equipmentSetList: [ "055", "058", "024", "055", "060", "074" ] },
                    { tier: 5, equipmentSetList: [ "093", "043", "086", "051", "084", "079" ] },
                    { tier: 6, equipmentSetList: [ "075", "055", "092", "092", "093", "097" ] },
                    { tier: 7, equipmentSetList: [ "089", "079", "106", "172", "100", "099" ] },
                    { tier: 8, equipmentSetList: [ "108", "117", "099", "112", "111", "117" ] },
                    { tier: 9, equipmentSetList: [ "172", "102", "079", "117", "106", "111" ] },
                    { tier: 10, equipmentSetList: [ "144", "172", "129", "173", "129", "144" ] },
                    { tier: 11, equipmentSetList: [ "109", "129", "146", "134", "144", "153" ] },
                    { tier: 12, equipmentSetList: [ "158", "160", "160", "166", "168", "G12Finisher_GRANDINQUISITOR_C" ] },
                    { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
                ],
                crewList: [],
                creationRecipeReference: "creationrecipe_GRANDINQUISITOR",
                legend: false
            },
        ]);
    });
});

describe("unitsToCharacterDB", () => {
    const bulkWriteArr = dataUpdater.unitsToCharacterDB(JSON.parse(JSON.stringify(formattedUnits)));
    it("Should return an array of mongo operations to bulk write unit info", () => {
        assert.deepStrictEqual(bulkWriteArr, [
            {
                updateOne: {
                    filter: { baseId: "GRANDINQUISITOR" },
                    update: {
                        "$set": {
                            baseId: "GRANDINQUISITOR",
                            skillReferenceList: [ { skillId: "basicskill_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR01", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_GRANDINQUISITOR02", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "leaderskill_GRANDINQUISITOR", requiredTier: 6, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_GRANDINQUISITOR01", requiredTier: 8, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_INQUISITOR01_GRANDINQUISITOR", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ],
                            combatType: 1,
                            unitTierList: [
                                { tier: 1, equipmentSetList: [ "001", "002", "003", "004", "004", "005" ] },
                                { tier: 2, equipmentSetList: [ "025", "021", "015", "028", "028", "025" ] },
                                { tier: 3, equipmentSetList: [ "043", "060", "050", "041", "047", "049" ] },
                                { tier: 4, equipmentSetList: [ "055", "058", "024", "055", "060", "074" ] },
                                { tier: 5, equipmentSetList: [ "093", "043", "086", "051", "084", "079" ] },
                                { tier: 6, equipmentSetList: [ "075", "055", "092", "092", "093", "097" ] },
                                { tier: 7, equipmentSetList: [ "089", "079", "106", "172", "100", "099" ] },
                                { tier: 8, equipmentSetList: [ "108", "117", "099", "112", "111", "117" ] },
                                { tier: 9, equipmentSetList: [ "172", "102", "079", "117", "106", "111" ] },
                                { tier: 10, equipmentSetList: [ "144", "172", "129", "173", "129", "144" ] },
                                { tier: 11, equipmentSetList: [ "109", "129", "146", "134", "144", "153" ] },
                                { tier: 12, equipmentSetList: [ "158", "160", "160", "166", "168", "G12Finisher_GRANDINQUISITOR_C" ] },
                                { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
                            ],
                            legend: false,
                            factions: [ "Dark Side", "Attacker", "Leader", "Empire", "Inquisitorius" ],
                            crew: []
                        }
                    },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { baseId: "EMPERORSSHUTTLE" },
                    update: {
                        "$set": {
                            baseId: "EMPERORSSHUTTLE",
                            skillReferenceList: [
                                { skillId: "basicskill_emperorsshuttle", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                                { skillId: "uniqueskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                                { skillId: "hardwareskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                                { skillId: "specialskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 },
                                { skillId: "specialskill_emperorsshuttle02", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ],
                            combatType: 2,
                            unitTierList: [],
                            legend: false,
                            factions: [ "Dark Side", "Support", "Empire", "Sith" ],
                            crew: [ "EMPERORPALPATINE", "ROYALGUARD" ]
                        }
                    },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { baseId: "BADBATCHECHO" },
                    update: {
                        "$set": {
                            baseId: "BADBATCHECHO",
                            skillReferenceList: [ { skillId: "basicskill_BADBATCHECHO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_BADBATCHECHO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_BADBATCHECHO02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_BADBATCHECHO01", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 } ],
                            combatType: 1,
                            unitTierList: [
                                { tier: 1, equipmentSetList: [ "007", "007", "003", "008", "011", "010" ] },
                                { tier: 2, equipmentSetList: [ "025", "030", "014", "018", "028", "032" ] },
                                { tier: 3, equipmentSetList: [ "034", "014", "028", "041", "069", "049" ] },
                                { tier: 4, equipmentSetList: [ "068", "022", "037", "068", "049", "082" ] },
                                { tier: 5, equipmentSetList: [ "089", "065", "070", "015", "040", "088" ] },
                                { tier: 6, equipmentSetList: [ "045", "041", "041", "047", "073", "090" ] },
                                { tier: 7, equipmentSetList: [ "102", "068", "070", "054", "083", "107" ] },
                                { tier: 8, equipmentSetList: [ "095", "054", "117", "103", "112", "111" ] },
                                { tier: 9, equipmentSetList: [ "071", "095", "172", "113", "114", "125" ] },
                                { tier: 10, equipmentSetList: [ "173", "117", "172", "083", "114", "144" ] },
                                { tier: 11, equipmentSetList: [ "117", "136", "146", "131", "137", "144" ] },
                                { tier: 12, equipmentSetList: [ "165", "162", "161", "168", "169", "G12Finisher_BADBATCHECHO_B" ] },
                                { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
                            ],
                            legend: false,
                            factions: [ "Light Side", "Support", "Bad Batch", "Clone Trooper", "Galactic Republic" ],
                            crew: []
                        }
                    },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { baseId: "QUIGONJINN" },
                    update: {
                        "$set": {
                            baseId: "QUIGONJINN",
                            skillReferenceList: [ { skillId: "specialskill_QUIGONJINN01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_QUIGONJINN02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "basicskill_QUIGONJINN", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "leaderskill_QUIGONJINN", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 } ],
                            combatType: 1,
                            unitTierList: [
                                { tier: 1, equipmentSetList: [ "001", "004", "009", "009", "003", "011" ] },
                                { tier: 2, equipmentSetList: [ "009", "020", "015", "028", "014", "032" ] },
                                { tier: 3, equipmentSetList: [ "054", "059", "041", "041", "033", "060" ] },
                                { tier: 4, equipmentSetList: [ "067", "068", "068", "049", "077", "047" ] },
                                { tier: 5, equipmentSetList: [ "089", "072", "024", "083", "093", "073" ] },
                                { tier: 6, equipmentSetList: [ "098", "095", "091", "089", "085", "088" ] },
                                { tier: 7, equipmentSetList: [ "105", "109", "092", "095", "095", "103" ] },
                                { tier: 8, equipmentSetList: [ "111", "112", "109", "098", "072", "080" ] },
                                { tier: 9, equipmentSetList: [ "122", "125", "103", "098", "105", "095" ] },
                                { tier: 10, equipmentSetList: [ "132", "125", "105", "098", "088", "080" ] },
                                { tier: 11, equipmentSetList: [ "136", "136", "145", "140", "137", "150" ] },
                                { tier: 12, equipmentSetList: [ "158", "165", "163", "169", "169", "G12Finisher_QUIGONJINN_C" ] },
                                { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
                            ],
                            legend: false,
                            factions: [ "Light Side", "Support", "Leader", "Galactic Republic", "Jedi" ],
                            crew: []
                        }
                    },
                    upsert: true
                }
            },
            {
                updateOne: {
                    filter: { baseId: "ROSETICO" },
                    update: {
                        "$set": {
                            baseId: "ROSETICO",
                            skillReferenceList: [ { skillId: "basicskill_ROSETICO", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_ROSETICO01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "specialskill_ROSETICO02", requiredTier: 2, requiredRarity: 8, requiredRelicTier: 1 }, { skillId: "uniqueskill_ROSETICO01", requiredTier: 4, requiredRarity: 8, requiredRelicTier: 1 } ],
                            combatType: 1,
                            unitTierList: [
                                { tier: 1, equipmentSetList: [ "002", "006", "003", "011", "010", "001" ] },
                                { tier: 2, equipmentSetList: [ "017", "018", "015", "019", "032", "034" ] },
                                { tier: 3, equipmentSetList: [ "041", "053", "060", "048", "043", "047" ] },
                                { tier: 4, equipmentSetList: [ "073", "055", "056", "078", "058", "051" ] },
                                { tier: 5, equipmentSetList: [ "088", "089", "102", "075", "049", "077" ] },
                                { tier: 6, equipmentSetList: [ "089", "079", "091", "088", "078", "072" ] },
                                { tier: 7, equipmentSetList: [ "113", "110", "097", "088", "108", "068" ] },
                                { tier: 8, equipmentSetList: [ "118", "089", "113", "090", "112", "084" ] },
                                { tier: 9, equipmentSetList: [ "125", "115", "113", "109", "103", "080" ] },
                                { tier: 10, equipmentSetList: [ "126", "129", "131", "117", "113", "129" ] },
                                { tier: 11, equipmentSetList: [ "143", "134", "129", "138", "117", "129" ] },
                                { tier: 12, equipmentSetList: [ "160", "159", "164", "168", "170", "G12Finisher_ROSETICO_A" ] },
                                { tier: 13, equipmentSetList: [ "9999", "9999", "9999", "9999", "9999", "9999" ] }
                            ],
                            legend: false,
                            factions: [ "Light Side", "Attacker", "Resistance" ],
                            crew: []
                        }
                    },
                    upsert: true
                }
            }
        ]);
    });
});

describe("unitsForUnitMapFile", () => {
    const unitMap = dataUpdater.unitsForUnitMapFile(JSON.parse(JSON.stringify(formattedUnits)));
    it("should return the units mapped as such: {defId:{nameKey, combatType, crew}}", () => {
        assert.deepStrictEqual(unitMap, {
            GRANDINQUISITOR: { nameKey: "UNIT_GRANDINQUISITOR_NAME", combatType: 1, crew: [] },
            EMPERORSSHUTTLE: {
                nameKey: "UNIT_EMPERORSSHUTTLE_NAME",
                combatType: 2,
                crew: [
                    { skillReferenceList: [ { skillId: "specialskill_emperorsshuttle01", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ], unitId: "EMPERORPALPATINE", slot: 0 },
                    { skillReferenceList: [ { skillId: "specialskill_emperorsshuttle02", requiredTier: 1, requiredRarity: 8, requiredRelicTier: 1 } ], unitId: "ROYALGUARD", slot: 1 }
                ]
            },
            BADBATCHECHO: { nameKey: "UNIT_BADBATCHECHO_NAME", combatType: 1, crew: [] },
            QUIGONJINN: { nameKey: "UNIT_QUIGONJINN_NAME", combatType: 1, crew: [] },
            ROSETICO: { nameKey: "UNIT_ROSETICO_NAME", combatType: 1, crew: [] }
        });
    });
});



// This one combines stuff from so many bits before
// describe("unitsForUnitMapFile", () => {
//     const catMap = {
//         'role_support': 'CATEGORY_ROLESUPPORT_DESC',
//         "alignment_dark": "ForceAlignment_Dark",
//         "alignment_light": "ForceAlignment_Light",
//         "affiliation_empire": "CATEGORY_EMPIRE_DESC",
//         "profession_sith": "CATEGORY_SITH_DESC",
//     }
//     const locales = {eng_us: {
//         'UNIT_EMPERORSSHUTTLE_NAME': 'Emperor\'s Shuttle',
//         "UNIT_ROSETICO_NAME": "Rose Tico",
//         "UNIT_GRANDINQUISITOR_NAME": "Grand Inquisitor",
//         "UNIT_BADBATCHECHO_NAME": "Bad Batch Echo",
//         "UNIT_QUIGONJINN_NAME": "QuigonJinn"
//     }};
//     const unitDefIdMap = {
//         EMPERORPALPATINE: "Emperor Palpatine",
//         ROYALGUARD: "Royal Guard"
//     };
//     const {charactersOut, shipsOut} = dataUpdater.unitsToUnitFiles(JSON.parse(JSON.stringify(formattedUnits)), locales, catMap, unitDefIdMap, unitRecipeMap, unitShardMap);
//     it("should return the units mapped as such: {defId:{nameKey, combatType, crew}}", () => {
//         expect(shipsOut).toEqual({
//             name: "Emperor's Shuttle",
//             uniqueName: 'EMPERORSSHUTTLE',
//             aliases: [ "Emperor's Shuttle" ],
//             crew: [ 'Emperor Palpatine', 'Royal Guard' ],
//             url: 'http://swgoh.gg/ships/emperors-shuttle/',
//             avatarURL: 'https://game-assets.swgoh.gg/tex.charui_imperialshuttle.png',
//             side: 'dark',
//             factions: [ 'Empire', 'Sith', 'Support' ],
//             abilities: {},
//             shardLocations: { dark: [], light: [], cantina: [], shops: [] },
//             avatarName: 'charui_imperialshuttle'
//         });
//     });
// });




// describe("processJourneyReqs", () => {
//
// })

// describe("saveRaidNames", () => {
//
// })