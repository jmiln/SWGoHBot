/**
 * MongoDB Index Configuration for SWGoHBot
 *
 * This file defines all indexes that should exist on MongoDB collections.
 * Run verifyIndexes.ts to check and create missing indexes.
 */

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
    // swgohbot database - Bot-specific data
    swgohbot: {
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
        ],
    },

    // swapidb database - Game data from SWAPI
    swapidb: {
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

        // Zeta recommendations
        zetaRec: [
            {
                key: { lang: 1 },
                options: {
                    name: "idx_zetarec_lang",
                },
            },
        ],
    },
};

export default indexConfig;
