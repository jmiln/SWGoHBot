import { z } from "zod";

export const CounterEntrySchema = z.object({
    attack: z.array(z.string()),
    atkLeader: z.string(),
    wins: z.number(),
    total: z.number(),
    draws: z.number(),
});

export const CounterVariantSchema = z.object({
    defense: z.array(z.string()),
    sampleN: z.number(),
    counters: z.array(CounterEntrySchema),
});

export const CounterOverallSchema = z.object({
    sampleN: z.number(),
    counters: z.array(CounterEntrySchema),
});

export const CounterDocSchema = z.object({
    mode: z.enum(["5v5", "3v3"]),
    battleType: z.enum(["char", "fleet"]),
    leader: z.string(),
    instanceId: z.string(),
    season: z.number(),
    overall: CounterOverallSchema,
    variants: z.array(CounterVariantSchema),
});

export const CounterMetadataSchema = z.object({
    lastInstanceId: z.string(),
    season: z.number(),
    status: z.string(),
    ingestedAt: z.string(),
    leaderDocs: z.number(),
    players: z.number(),
});

export const CounterMetadataFileSchema = z.object({
    "5v5": CounterMetadataSchema.optional(),
    "3v3": CounterMetadataSchema.optional(),
});

export type CounterEntry = z.infer<typeof CounterEntrySchema>;
export type CounterVariant = z.infer<typeof CounterVariantSchema>;
export type CounterDoc = z.infer<typeof CounterDocSchema>;
export type CounterMetadata = z.infer<typeof CounterMetadataSchema>;
export type CounterMetadataFile = z.infer<typeof CounterMetadataFileSchema>;
