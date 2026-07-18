/**
 * MongoDB Index Configuration for SWGoHBot
 *
 * This file defines all indexes that should exist on MongoDB collections.
 * Run verifyIndexes.ts to check and create missing indexes.
 *
 * Database keys are resolved from env (config.ts), not hardcoded, so the verifier
 * targets the same databases the app actually reads/writes (e.g. MONGODB_SWAPI_DB
 * defaults to "swapi", not "swapidb"). Hardcoding them silently created indexes on
 * an unused database while the real collections went unindexed.
 */

import { env } from "./config.ts";

export interface IndexDefinition {
    key: Record<string, 1 | -1>;
    options?: {
        name?: string;
        unique?: boolean;
        sparse?: boolean;
        expireAfterSeconds?: number;
        background?: boolean;
    };
}

export interface CollectionIndexes {
    [collectionName: string]: IndexDefinition[];
}

export interface DatabaseIndexes {
    [databaseName: string]: CollectionIndexes;
}

/**
 * Complete index configuration for all databases
 */
export const indexConfig: DatabaseIndexes = {
    // Bot-specific data (MONGODB_SWGOHBOT_DB, default "swgohbot")
    [env.MONGODB_SWGOHBOT_DB]: {
        // User configurations and ally code mappings
        users: [
            {
                key: { id: 1 },
                options: {
                    name: "idx_users_id",
                    unique: true,
                },
            },
            {
                key: { "accounts.allyCode": 1 },
                options: {
                    name: "idx_users_accounts_allycode",
                    sparse: true,
                },
            },
            {
                key: { bonusServer: 1 },
                options: {
                    name: "idx_users_bonusserver",
                    sparse: true,
                },
            },
        ],

        // Arena player rank and history data — one document per ally code
        arenaPlayers: [
            {
                key: { allyCode: 1 },
                options: {
                    name: "idx_arenaplayers_allycode",
                    unique: true,
                },
            },
        ],

        // Guild configurations (settings, events, polls, aliases, etc.)
        guildConfigs: [
            {
                key: { guildId: 1 },
                options: {
                    name: "idx_guildconfigs_guildid",
                    unique: true,
                },
            },
            {
                key: { "events.eventDT": 1 },
                options: {
                    name: "idx_guildconfigs_events_eventdt",
                    sparse: true,
                },
            },
            {
                key: { "events.countdown": 1, "events.eventDT": 1 },
                options: {
                    name: "idx_guildconfigs_events_countdown_eventdt",
                    sparse: true,
                },
            },
            {
                key: { "patreonSettings.supporters.userId": 1 },
                options: {
                    name: "idx_guildconfigs_patreon_supporters_userid",
                    sparse: true,
                },
            },
        ],

        // Patreon subscriber data
        patrons: [
            {
                key: { discordID: 1 },
                options: {
                    name: "idx_patrons_discordid",
                    unique: true,
                },
            },
            {
                // TTL index - auto-delete lapsed patrons 7 days after last update
                key: { updatedAt: 1 },
                options: {
                    name: "idx_patrons_ttl",
                    expireAfterSeconds: 604800, // 7 days
                },
            },
        ],

        // Command usage statistics
        commandStats: [
            {
                key: { timestamp: 1 },
                options: {
                    name: "idx_commandstats_timestamp",
                },
            },
            {
                key: { commandName: 1, timestamp: 1 },
                options: {
                    name: "idx_commandstats_command_timestamp",
                },
            },
            {
                key: { userId: 1, timestamp: 1 },
                options: {
                    name: "idx_commandstats_user_timestamp",
                },
            },
            {
                key: { guildId: 1, timestamp: 1 },
                options: {
                    name: "idx_commandstats_guild_timestamp",
                    sparse: true,
                },
            },
            {
                // TTL index to auto-delete old stats after 90 days
                key: { timestamp: 1 },
                options: {
                    name: "idx_commandstats_ttl",
                    expireAfterSeconds: 7776000, // 90 days
                },
            },
        ],
    },

    // Game data from SWAPI (MONGODB_SWAPI_DB, default "swapi")
    [env.MONGODB_SWAPI_DB]: {
        // Raw player data from API
        rawPlayers: [
            {
                key: { allyCode: 1 },
                options: {
                    name: "idx_rawplayers_allycode",
                    unique: true,
                },
            },
            {
                key: { updated: 1 },
                options: {
                    name: "idx_rawplayers_updated",
                },
            },
            {
                key: { guildId: 1 },
                options: {
                    name: "idx_rawplayers_guildid",
                    sparse: true,
                },
            },
        ],

        // Processed player statistics
        playerStats: [
            {
                key: { allyCode: 1 },
                options: {
                    name: "idx_playerstats_allycode",
                    unique: true,
                },
            },
            {
                key: { updated: 1 },
                options: {
                    name: "idx_playerstats_updated",
                },
            },
        ],

        // Raw guild data from API
        rawGuilds: [
            {
                key: { id: 1 },
                options: {
                    name: "idx_rawguilds_id",
                    unique: true,
                },
            },
            {
                key: { updated: 1 },
                options: {
                    name: "idx_rawguilds_updated",
                },
            },
        ],

        // Processed guild data
        guilds: [
            {
                key: { id: 1 },
                options: {
                    name: "idx_guilds_id",
                    unique: true,
                },
            },
            {
                key: { name: 1 },
                options: {
                    name: "idx_guilds_name",
                },
            },
            {
                key: { updated: 1 },
                options: {
                    name: "idx_guilds_updated",
                },
            },
        ],

        // Character definitions
        characters: [
            {
                key: { baseId: 1 },
                options: {
                    name: "idx_characters_baseid",
                    unique: true,
                },
            },
        ],

        // Localized game data written by dataUpdater's processLocalization().
        // Each upsert filters by { <idKey>, language }; without these compound
        // indexes every upsert is a full collection scan, making the bulkWrite
        // O(N^2) (e.g. ~3.5min for ~27k abilities docs).
        abilities: [
            {
                key: { id: 1, language: 1 },
                options: {
                    name: "idx_abilities_id_language",
                    unique: true,
                },
            },
        ],

        categories: [
            {
                key: { id: 1, language: 1 },
                options: {
                    name: "idx_categories_id_language",
                    unique: true,
                },
            },
        ],

        gear: [
            {
                key: { id: 1, language: 1 },
                options: {
                    name: "idx_gear_id_language",
                    unique: true,
                },
            },
        ],

        recipes: [
            {
                key: { id: 1, language: 1 },
                options: {
                    name: "idx_recipes_id_language",
                    unique: true,
                },
            },
        ],

        units: [
            {
                key: { baseId: 1, language: 1 },
                options: {
                    name: "idx_units_baseid_language",
                    unique: true,
                },
            },
        ],

        // Zeta recommendations
        zetaRec: [
            {
                key: { lang: 1 },
                options: {
                    name: "idx_zetarec_lang",
                },
            },
        ],

        // GAC battle counter data — derived win rates per leader
        counterData: [
            {
                key: { mode: 1, battleType: 1, leader: 1, instanceId: 1 },
                options: {
                    name: "idx_counterdata_lookup",
                },
            },
        ],
    },
};

export default indexConfig;
