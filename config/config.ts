import { z } from "zod";

// Load environment variables from .env file (Node.js 20.6+)
// Will load ".env" file if present.
// If you want a specific file, use `node --env-file=.other-env <file>`
process.loadEnvFile?.();

// Helper for URL validation (Zod v4 deprecated .url() method)
// Usage:
//   urlString({ default: "http://..." })           - URL with default value
//   urlString({ required: "Error message" })       - Required URL, no default
//   urlString({ optional: true })                  - Optional URL
const urlString = (opts: { default?: string; required?: string; optional?: boolean } = {}) => {
    const urlValidator = (val: string) => {
        try {
            new URL(val);
            return true;
        } catch {
            return false;
        }
    };

    // Handle optional URLs
    if (opts.optional) {
        return z
            .string()
            .optional()
            .refine((val) => !val || urlValidator(val), { message: "Invalid URL format" });
    }

    // Handle URLs with default value
    if (opts.default) {
        return z.string().default(opts.default).refine(urlValidator, { message: "Invalid URL format" });
    }

    // Handle required URLs
    if (opts.required) {
        return z.string().min(1, opts.required).refine(urlValidator, { message: "Invalid URL format" });
    }

    // Fallback: required URL with generic message
    return z.string().min(1).refine(urlValidator, { message: "Invalid URL format" });
};

// Zod schema for environment variables with validation and defaults
const envSchema = z.object({
    // Discord Configuration
    DISCORD_OWNER_ID: z.string().min(1, "DISCORD_OWNER_ID is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
    DISCORD_DEV_SERVER: z.string().optional(),
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
    DISCORD_WEBHOOK_URL: urlString({ optional: true }),

    // MongoDB Configuration
    MONGODB_URL: urlString({ required: "MONGODB_URL is required" }),
    MONGODB_SWGOHBOT_DB: z.string().default("swgohbot"),
    MONGODB_SWAPI_DB: z.string().default("swapi"),

    // Event Server Configuration
    EVENT_SERVER_URL: urlString({ default: "ws://localhost:3700" }),
    EVENT_SERVER_PORT: z.coerce.number().int().positive().default(3700),

    // Logging Configuration
    DEBUG_LOGS: z.coerce.boolean().default(false),
    LOG_TO_CHANNEL: z.coerce.boolean().default(false),
    LOG_CHANNEL_ID: z.string().optional().default(""),
    LOG_COMMANDS: z.coerce.boolean().default(false),

    // Premium Configuration
    PREMIUM: z.coerce.boolean().default(false),

    // Image Server Configuration
    IMAGE_SERVER_URL: urlString({ default: "http://localhost:3600" }),

    // SWAPI Configuration
    SWAPI_STATCALC_URL: urlString({ required: "SWAPI_STATCALC_URL is required" }),
    SWAPI_CLIENT_URL: urlString({ required: "SWAPI_CLIENT_URL is required" }),
    SWAPI_ACCESS_KEY: z.string().min(1, "SWAPI_ACCESS_KEY is required"),
    SWAPI_SECRET_KEY: z.string().min(1, "SWAPI_SECRET_KEY is required"),

    // Patreon V2 API Configuration (all optional)
    PATREON_API_URL: urlString({ default: "https://www.patreon.com/api/oauth2/v2" }),
    PATREON_CAMPAIGN_ID: z.string().optional(),
    PATREON_CLIENT_ID: z.string().optional(),
    PATREON_CLIENT_SECRET: z.string().optional(),
    PATREON_CREATOR_ACCESS_TOKEN: z.string().optional(),
    PATREON_CREATOR_REFRESH_TOKEN: z.string().optional(),

    // Patrons Configuration (JSON string: {"discordId": tierLevel})
    PATRONS: z.string().optional().default("{}"),
});

// Parse and validate environment variables
export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
