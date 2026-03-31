import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc/init";
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
});
