import { z } from "zod";

// Load environment variables from .env file (Node.js 20.6+)
process.loadEnvFile?.();

// Zod schema for environment variables with validation and defaults
const envSchema = z.object({
    // Discord Configuration
    DISCORD_OWNER_ID: z.string().min(1, "DISCORD_OWNER_ID is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
    DISCORD_DEV_SERVER: z.string().optional(),
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
    DISCORD_WEBHOOK_URL: z.string().optional(),

    // Shard Configuration
    SHARD_COUNT: z.coerce.number().int().positive().default(1),

    // MongoDB Configuration
    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),
    MONGODB_SWGOHBOT_DB: z.string().default("swgohbot"),
    MONGODB_SWAPI_DB: z.string().default("swapi"),

    // Event Server Configuration
    EVENT_SERVER_PORT: z.coerce.number().int().positive().default(3700),

    // Logging Configuration
    DEBUG_LOGS: z.coerce.boolean().default(false),
    LOG_TO_CHANNEL: z.coerce.boolean().default(false),
    LOG_CHANNEL_ID: z.string().optional().default(""),
    LOG_COMMANDS: z.coerce.boolean().default(false),

    // Premium Configuration
    PREMIUM: z.coerce.boolean().default(false),

    // Image Server Configuration
    IMAGE_SERVER_URL: z.string().default("http://localhost:3600"),

    // SWAPI Configuration
    SWAPI_STATCALC_URL: z.string().min(1, "SWAPI_STATCALC_URL is required"),
    SWAPI_CLIENT_URL: z.string().min(1, "SWAPI_CLIENT_URL is required"),
    SWAPI_ACCESS_KEY: z.string().min(1, "SWAPI_ACCESS_KEY is required"),
    SWAPI_SECRET_KEY: z.string().min(1, "SWAPI_SECRET_KEY is required"),

    // Patreon V2 API Configuration (all optional)
    PATREON_CAMPAIGN_ID: z.string().optional(),
    PATREON_CLIENT_ID: z.string().optional(),
    PATREON_CLIENT_SECRET: z.string().optional(),
    PATREON_CREATOR_ACCESS_TOKEN: z.string().optional(),
    PATREON_CREATOR_REFRESH_TOKEN: z.string().optional(),

    // Patrons Configuration (JSON string: {"discordId": tierLevel})
    PATRONS: z.string().optional().default("{}"),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Export config object matching the structure of the old config.js
const config = {
    ownerid: env.DISCORD_OWNER_ID,
    clientId: env.DISCORD_CLIENT_ID,
    dev_server: env.DISCORD_DEV_SERVER,
    token: env.DISCORD_TOKEN,
    shardCount: env.SHARD_COUNT,

    mongodb: {
        url: env.MONGODB_URL,
        swgohbotdb: env.MONGODB_SWGOHBOT_DB,
        swapidb: env.MONGODB_SWAPI_DB,
    },

    eventServe: {
        port: env.EVENT_SERVER_PORT,
    },

    webhookURL: env.DISCORD_WEBHOOK_URL,
    debugLogs: env.DEBUG_LOGS,

    logs: {
        logToChannel: env.LOG_TO_CHANNEL,
        channel: env.LOG_CHANNEL_ID,
        logComs: env.LOG_COMMANDS,
    },

    premium: env.PREMIUM,

    imageServIP_Port: env.IMAGE_SERVER_URL,

    // Patron configuration - parsed from JSON string in .env
    patrons: JSON.parse(env.PATRONS) as Record<string, number>,

    // Patreon V2 API configuration - populated from environment if all fields present
    patreonV2:
        env.PATREON_CAMPAIGN_ID &&
        env.PATREON_CLIENT_ID &&
        env.PATREON_CLIENT_SECRET &&
        env.PATREON_CREATOR_ACCESS_TOKEN &&
        env.PATREON_CREATOR_REFRESH_TOKEN
            ? {
                  campaignId: env.PATREON_CAMPAIGN_ID,
                  clientID: env.PATREON_CLIENT_ID,
                  clientSecret: env.PATREON_CLIENT_SECRET,
                  creatorAccessToken: env.PATREON_CREATOR_ACCESS_TOKEN,
                  creatorRefreshToken: env.PATREON_CREATOR_REFRESH_TOKEN,
              }
            : undefined,

    swapiConfig: {
        statCalc: {
            url: env.SWAPI_STATCALC_URL,
        },
        clientStub: {
            url: env.SWAPI_CLIENT_URL,
            accessKey: env.SWAPI_ACCESS_KEY,
            secretKey: env.SWAPI_SECRET_KEY,
        },
    },
};

export default config;
