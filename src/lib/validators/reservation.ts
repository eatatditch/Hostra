import { z } from "zod";

export const createReservationSchema = z.object({
  locationId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(20),
  specialRequests: z.string().max(500).optional(),
  source: z.enum(["web", "phone", "walk_in", "staff"]).default("web"),
});

export const updateReservationSchema = z.object({
  reservationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  partySize: z.number().int().min(1).max(20).optional(),
  specialRequests: z.string().max(500).optional(),
  tableId: z.string().uuid().nullable().optional(),
});

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
  token: z.string().optional(),
});

export const seatReservationSchema = z.object({
  reservationId: z.string().uuid(),
  tableId: z.string().uuid(),
});

export const availabilityQuerySchema = z.object({
  locationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1).max(20),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
