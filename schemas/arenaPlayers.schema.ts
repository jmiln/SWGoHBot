import { z } from "zod";

export const ArenaHistEntrySchema = z.object({ rank: z.number(), ts: z.number() });

export const ArenaPlayerSchema = z.object({
    allyCode: z.number(),
    name: z.string(),
    lastCharRank: z.number().optional(),
    lastShipRank: z.number().optional(),
    lastCharClimb: z.number().optional(),
    lastShipClimb: z.number().optional(),
    lastCharChange: z.number().optional(),
    lastShipChange: z.number().optional(),
    charHist: z.array(ArenaHistEntrySchema).optional(),
    shipHist: z.array(ArenaHistEntrySchema).optional(),
});

export type ArenaPlayer = z.infer<typeof ArenaPlayerSchema>;
