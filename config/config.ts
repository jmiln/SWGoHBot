import { z } from "zod";

// Load environment variables from .env file (Node.js 20.6+)
// Will load ".env" file if present.
// If you want a specific file, use `node --env-file=.other-env <file>`
//
// The file is genuinely optional, so a missing one is not an error: containers get their config
// from the environment (compose `env_file`/`environment`, docker `--env-file`), all of which set
// variables without creating a file. loadEnvFile throws ENOENT rather than returning quietly, and
// an unguarded call makes the image unable to start at all. Nothing is lost by ignoring it: the
// schema below still fails loudly, and by name, if a required variable is missing either way.
try {
    process.loadEnvFile?.();
} catch {
    // No .env on disk; the environment is expected to carry the config.
}

// Helper for URL validation (Zod v4 deprecated .url() method)
// Usage:
//   urlString({ default: "http://..." })           - URL with default value
//   urlString({ required: "Error message" })       - Required URL, no default
//   urlString({ optional: true })                  - Optional URL
function urlString(opts: { optional: true; default?: undefined; required?: undefined }): z.ZodType<string | undefined>;
function urlString(opts?: { default?: string; required?: string; optional?: false }): z.ZodType<string>;
function urlString(opts: { default?: string; required?: string; optional?: boolean } = {}): z.ZodType<string | undefined> {
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
}

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
    EVENT_SERVER_URL: urlString({ default: "http://localhost:3700" }),
    EVENT_SERVER_PORT: z.coerce.number().int().positive().default(3700),
    EVENT_SERVER_SECRET: z.string().default(""),

    // Logging Configuration
    DEBUG_LOGS: z.coerce.boolean().default(false),
    LOG_TO_CHANNEL: z.coerce.boolean().default(false),
    LOG_CHANNEL_ID: z.string().optional().default(""),
    LOG_TIMEZONE: z
        .string()
        .default("America/Los_Angeles")
        .refine(
            (tz) => {
                try {
                    Intl.DateTimeFormat(undefined, { timeZone: tz });
                    return true;
                } catch {
                    return false;
                }
            },
            { message: "LOG_TIMEZONE must be a valid IANA timezone (e.g. America/Los_Angeles)" },
        ),

    // Premium Configuration
    PREMIUM: z.coerce.boolean().default(false),

    // Image Server Configuration
    IMAGE_SERVER_URL: urlString({ default: "http://localhost:3600" }),

    // SWAPI Configuration
    SWAPI_STATCALC_URL: urlString({ required: "SWAPI_STATCALC_URL is required" }),
    SWAPI_CLIENT_URL: urlString({ required: "SWAPI_CLIENT_URL is required" }),
    SWAPI_ACCESS_KEY: z.string().min(1, "SWAPI_ACCESS_KEY is required"),
    SWAPI_SECRET_KEY: z.string().min(1, "SWAPI_SECRET_KEY is required"),

    // swapiServe: the local queueing proxy every comlink request passes through. No secret,
    // because ComlinkStub uses the Authorization header for its HMAC signature; the service binds
    // to loopback instead and every client runs on this host.
    SWAPI_SERVE_URL: urlString({ default: "http://localhost:3800" }),
    SWAPI_SERVE_PORT: z.coerce.number().int().positive().default(3800),

    // swapiServe binds loopback by default, which is its only access control. A container must set
    // 0.0.0.0 to be reachable from the bot container, and should pair that with
    // SWAPI_SERVE_CONTROL_SECRET (see services/swapiServe/index.ts).
    SWAPI_SERVE_HOST: z.string().default("127.0.0.1"),

    // Guards the /backend/<url>/drain|enable|set-limit control routes. Optional: unset leaves them
    // open, which is safe only while the service is bound to loopback.
    SWAPI_SERVE_CONTROL_SECRET: z.string().optional(),

    // Patreon V2 API Configuration (all optional)
    PATREON_CAMPAIGN_ID: z.string().optional(),
    PATREON_CLIENT_ID: z.string().optional(),
    PATREON_CLIENT_SECRET: z.string().optional(),
    PATREON_CREATOR_ACCESS_TOKEN: z.string().optional(),
    PATREON_CREATOR_REFRESH_TOKEN: z.string().optional(),

    // Patrons Configuration (JSON string: {"discordId": tierLevel})
    PATRONS: z
        .string()
        .default("{}")
        .transform((str, ctx) => {
            try {
                const parsed = JSON.parse(str);
                // Validates that it is an object and not an array or primitive
                return z.record(z.string(), z.number()).parse(parsed);
            } catch (_) {
                ctx.addIssue({
                    code: "custom",
                    message: "PATRONS must be a valid JSON string",
                });
                return z.NEVER;
            }
        }),
});

// Parse and validate environment variables
export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
