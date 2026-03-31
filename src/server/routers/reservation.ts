import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";
import {
  createReservationSchema,
  updateReservationSchema,
  cancelReservationSchema,
  seatReservationSchema,
  availabilityQuerySchema,
} from "@/lib/validators/reservation";
import {
  createReservation,
  cancelReservation,
  updateReservation,
  seatReservation,
  completeReservation,
  markNoShow,
  undoNoShow,
  getReservationsByDate,
  getReservationByToken,
} from "@/server/services/reservation";
import { getAvailableSlots } from "@/server/services/availability";

export const reservationRouter = router({
  getAvailability: publicProcedure
    .input(availabilityQuerySchema)
    .query(async ({ input }) => {
      return getAvailableSlots(input);
    }),

  create: publicProcedure
    .input(createReservationSchema)
    .mutation(async ({ input }) => {
      return createReservation(input);
    }),

  cancel: publicProcedure
    .input(cancelReservationSchema)
    .mutation(async ({ input }) => {
      return cancelReservation(input.reservationId, input.token);
    }),

  update: protectedProcedure
    .input(updateReservationSchema)
    .mutation(async ({ input }) => {
      return updateReservation(input);
    }),

  seat: protectedProcedure
    .input(seatReservationSchema)
    .mutation(async ({ input }) => {
      return seatReservation(input.reservationId, input.tableId);
    }),

  complete: protectedProcedure
    .input(z.object({ reservationId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return completeReservation(input.reservationId);
    }),

  markNoShow: protectedProcedure
    .input(z.object({ reservationId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return markNoShow(input.reservationId);
    }),

  undoNoShow: protectedProcedure
    .input(z.object({ reservationId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return undoNoShow(input.reservationId);
    }),

  getByDate: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      return getReservationsByDate(input.locationId, input.date);
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const result = await getReservationByToken(input.token);
      if (!result) return null;
      // Omit confirmation token from public response
      const { confirmation_token, ...safe } = result;
      return safe;
    }),

  // Calendar: reservation counts by date for a month
  getMonthSummary: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ input }) => {
      const startDate = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
      const endMonth = input.month === 12 ? 1 : input.month + 1;
      const endYear = input.month === 12 ? input.year + 1 : input.year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const { data: reservations } = await supabase
        .from("reservations")
        .select("date, status, party_size")
        .eq("location_id", input.locationId)
        .gte("date", startDate)
        .lt("date", endDate);

      // Group by date
      const byDate = new Map<string, { total: number; covers: number; confirmed: number }>();
      for (const r of reservations || []) {
        if (!byDate.has(r.date)) byDate.set(r.date, { total: 0, covers: 0, confirmed: 0 });
        const entry = byDate.get(r.date)!;
        entry.total++;
        if (r.status !== "cancelled") {
          entry.covers += r.party_size || 0;
          entry.confirmed++;
        }
      }

      // Get blocked dates
      const { data: blocked } = await supabase
        .from("blocked_dates")
        .select("date, reason")
        .eq("location_id", input.locationId)
        .gte("date", startDate)
        .lt("date", endDate);

      const blockedSet = new Map<string, string>();
      for (const b of blocked || []) {
        blockedSet.set(b.date, b.reason || "");
      }

      return {
        reservations: Object.fromEntries(byDate),
        blockedDates: Object.fromEntries(blockedSet),
      };
    }),

  // Block/unblock a date
  blockDate: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        date: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { error } = await supabase
        .from("blocked_dates")
        .upsert(
          {
            location_id: input.locationId,
            date: input.date,
            reason: input.reason || null,
            created_by: ctx.session.id,
          },
          { onConflict: "location_id,date" }
        );

      if (error) throw new Error(error.message);
      return { blocked: true };
    }),

  unblockDate: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        date: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await supabase
        .from("blocked_dates")
        .delete()
        .eq("location_id", input.locationId)
        .eq("date", input.date);

      return { unblocked: true };
    }),
});
