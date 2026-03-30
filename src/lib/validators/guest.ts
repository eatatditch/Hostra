import { z } from "zod";

export const searchGuestsSchema = z.object({
  locationId: z.string().uuid(),
  query: z.string().min(1).max(100),
});

export const updateGuestSchema = z.object({
  guestId: z.string().uuid(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().nullable().optional(),
  anniversaryDate: z.string().nullable().optional(),
  dietaryRestrictions: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
});

export const addGuestNoteSchema = z.object({
  guestId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  flagged: z.boolean().default(false),
});

export const addGuestTagSchema = z.object({
  guestId: z.string().uuid(),
  tag: z.string().min(1).max(50),
});

export const removeGuestTagSchema = z.object({
  guestId: z.string().uuid(),
  tag: z.string().min(1).max(50),
});

export const mergeGuestsSchema = z.object({
  primaryGuestId: z.string().uuid(),
  duplicateGuestId: z.string().uuid(),
});
