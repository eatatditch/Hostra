import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc/init";
import { getDailySummary, getWeeklyTrend } from "@/server/services/analytics";

export const analyticsRouter = router({
  dailySummary: protectedProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      return getDailySummary(input.locationId, input.date);
    }),

  weeklyTrend: protectedProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input }) => {
      return getWeeklyTrend(input.locationId, input.endDate);
    }),
});
