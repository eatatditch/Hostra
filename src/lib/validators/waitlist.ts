import { z } from "zod";

export const joinWaitlistSchema = z.object({
  locationId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(10).max(20),
  partySize: z.number().int().min(1).max(20),
  source: z.enum(["web", "phone", "walk_in", "staff"]).default("walk_in"),
});

export const notifyWaitlistSchema = z.object({
  entryId: z.string().min(1),
});

export const seatWaitlistSchema = z.object({
  entryId: z.string().min(1),
  tableId: z.string().min(1),
});

export const removeWaitlistSchema = z.object({
  entryId: z.string().min(1),
});

export const updateWaitlistSchema = z.object({
  entryId: z.string().min(1),
  partySize: z.number().int().min(1).max(20).optional(),
  estimatedWaitMinutes: z.number().int().min(0).max(600).optional(),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type UpdateWaitlistInput = z.infer<typeof updateWaitlistSchema>;
