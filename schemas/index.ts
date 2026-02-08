/**
 * MongoDB Schema Validation using Zod
 *
 * This module exports all Zod schemas for MongoDB collections and provides
 * helper functions for validation.
 *
 * Usage:
 *   import { UserConfigSchema, validateDocument } from "./schemas/index.ts";
 *
 *   // Validate a document
 *   const result = validateDocument(UserConfigSchema, userData);
 *   if (result.success) {
 *     console.log("Valid user data:", result.data);
 *   } else {
 *     console.error("Invalid user data:", result.error);
 *   }
 *
 *   // Parse and throw on error
 *   const user = UserConfigSchema.parse(userData);
 */

import type { z } from "zod";

export * from "./commandStats.schema.ts";
export * from "./guildConfigs.schema.ts";
export * from "./guilds.schema.ts";
export * from "./patrons.schema.ts";
export * from "./players.schema.ts";
// Export all schemas
export * from "./users.schema.ts";

/**
 * Validation result type
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: z.ZodError };

/**
 * Safely validate a document against a schema
 * Returns a result object instead of throwing
 */
export function validateDocument<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}

/**
 * Validate and transform a document, throwing on error
 */
export function parseDocument<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data);
}

/**
 * Validate a partial document (useful for updates)
 * Note: This only works with ZodObject schemas
 */
export function validatePartial<T extends z.ZodRawShape>(schema: z.ZodObject<T>, data: unknown) {
    const partialSchema = schema.partial();
    return validateDocument(partialSchema, data);
}

/**
 * Format Zod errors into a readable string
 */
export function formatValidationError(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.join(".");
            return `${path}: ${issue.message}`;
        })
        .join("\n");
}
