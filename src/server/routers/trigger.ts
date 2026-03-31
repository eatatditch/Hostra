import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { evaluateTriggers } from "@/lib/triggers";
import { supabase } from "@/lib/db";

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
      const { data: updated, error } = await supabase
        .from("trigger_events")
        .update({
          actioned: true,
          actioned_by: ctx.session.id,
          actioned_note: input.note || null,
        })
        .eq("id", input.triggerEventId)
        .select()
        .single();

      if (error) throw new Error(error.message);
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

      const rows = input.triggers.map((t) => ({
        location_id: input.locationId,
        guest_id: input.guestId,
        reservation_id: input.reservationId || null,
        waitlist_entry_id: input.waitlistEntryId || null,
        trigger_type: t.type,
        severity: t.severity,
        payload: t.payload,
      }));

      const { data: events, error } = await supabase
        .from("trigger_events")
        .insert(rows)
        .select();

      if (error) throw new Error(error.message);
      return events;
    }),

  getConfig: roleProcedure("admin", "manager")
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("trigger_configs")
        .select("*")
        .eq("location_id", input.locationId);

      if (error) throw new Error(error.message);
      return data;
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
      const { data: result, error } = await supabase
        .from("trigger_configs")
        .upsert(
          {
            location_id: input.locationId,
            trigger_type: input.triggerType,
            enabled: input.enabled,
            threshold: input.threshold || {},
            updated_by: ctx.session.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "location_id,trigger_type" }
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return result;
    }),
});
