import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { evaluateTriggers } from "@/lib/triggers";
import { db } from "@/lib/db";
import { triggerEvents, triggerConfigs, reservations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const triggerRouter = router({
  evaluate: protectedProcedure
    .input(
      z.object({
        guestId: z.string().uuid(),
        locationId: z.string().uuid(),
        reservationId: z.string().uuid().optional(),
        partySize: z.number().int(),
        specialRequests: z.string().nullable().optional(),
        date: z.string(),
      })
    )
    .query(async ({ input }) => {
      return evaluateTriggers(input);
    }),

  logAction: protectedProcedure
    .input(
      z.object({
        triggerEventId: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await db
        .update(triggerEvents)
        .set({
          actioned: true,
          actionedBy: ctx.session.id,
          actionedNote: input.note || null,
        })
        .where(eq(triggerEvents.id, input.triggerEventId))
        .returning();
      return updated;
    }),

  saveTriggerEvents: protectedProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        guestId: z.string().uuid(),
        reservationId: z.string().uuid().optional(),
        waitlistEntryId: z.string().uuid().optional(),
        triggers: z.array(
          z.object({
            type: z.string(),
            severity: z.string(),
            message: z.string(),
            payload: z.record(z.string(), z.unknown()),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      if (input.triggers.length === 0) return [];

      const events = await db
        .insert(triggerEvents)
        .values(
          input.triggers.map((t) => ({
            locationId: input.locationId,
            guestId: input.guestId,
            reservationId: input.reservationId || null,
            waitlistEntryId: input.waitlistEntryId || null,
            triggerType: t.type as any,
            severity: t.severity as any,
            payload: t.payload,
          }))
        )
        .returning();

      return events;
    }),

  getConfig: roleProcedure("admin", "manager")
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.triggerConfigs.findMany({
        where: eq(triggerConfigs.locationId, input.locationId),
      });
    }),

  updateConfig: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().uuid(),
        triggerType: z.string(),
        enabled: z.boolean(),
        threshold: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [result] = await db
        .insert(triggerConfigs)
        .values({
          locationId: input.locationId,
          triggerType: input.triggerType as any,
          enabled: input.enabled,
          threshold: input.threshold || {},
          updatedBy: ctx.session.id,
        })
        .onConflictDoUpdate({
          target: [triggerConfigs.locationId, triggerConfigs.triggerType],
          set: {
            enabled: input.enabled,
            threshold: input.threshold || {},
            updatedBy: ctx.session.id,
            updatedAt: new Date(),
          },
        })
        .returning();

      return result;
    }),
});
