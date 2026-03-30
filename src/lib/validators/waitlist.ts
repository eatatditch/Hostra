import { z } from "zod";

export const joinWaitlistSchema = z.object({
  locationId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(10).max(20),
  partySize: z.number().int().min(1).max(20),
  source: z.enum(["web", "phone", "walk_in", "staff"]).default("walk_in"),
});

export const notifyWaitlistSchema = z.object({
  entryId: z.string().uuid(),
});

export const seatWaitlistSchema = z.object({
  entryId: z.string().uuid(),
  tableId: z.string().uuid(),
});

export const removeWaitlistSchema = z.object({
  entryId: z.string().uuid(),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
