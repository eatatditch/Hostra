import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "@/lib/trpc/init";
import {
  joinWaitlistSchema,
  notifyWaitlistSchema,
  seatWaitlistSchema,
  removeWaitlistSchema,
} from "@/lib/validators/waitlist";
import {
  joinWaitlist,
  notifyWaitlistEntry,
  seatWaitlistEntry,
  removeWaitlistEntry,
  getActiveWaitlist,
  getWaitlistByToken,
} from "@/server/services/waitlist";

export const waitlistRouter = router({
  join: publicProcedure
    .input(joinWaitlistSchema)
    .mutation(async ({ input }) => {
      return joinWaitlist(input);
    }),

  notify: protectedProcedure
    .input(notifyWaitlistSchema)
    .mutation(async ({ input }) => {
      return notifyWaitlistEntry(input.entryId);
    }),

  seat: protectedProcedure
    .input(seatWaitlistSchema)
    .mutation(async ({ input }) => {
      return seatWaitlistEntry(input.entryId, input.tableId);
    }),

  remove: protectedProcedure
    .input(removeWaitlistSchema)
    .mutation(async ({ input }) => {
      return removeWaitlistEntry(input.entryId);
    }),

  getActive: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getActiveWaitlist(input.locationId);
    }),

  checkStatus: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const entry = await getWaitlistByToken(input.token);
      if (!entry) return null;
      const { checkToken, ...safe } = entry;
      return safe;
    }),
});
