import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";
import {
  updateGuestSchema,
  addGuestNoteSchema,
  addGuestTagSchema,
  removeGuestTagSchema,
  mergeGuestsSchema,
} from "@/lib/validators/guest";
import {
  searchGuests,
  getGuestProfile,
  updateGuest,
  addNote,
  addTag,
  removeTag,
  mergeGuests,
} from "@/server/services/guest";

export const guestRouter = router({
  listAll: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      const { data, error, count } = await supabase
        .from("guests")
        .select("*, tags:guest_tags(*), metrics:guest_metrics(*, location:locations(id, name))", { count: "exact" })
        .order("first_name", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      const guests = (data || []).map((g: any) => ({
        ...g,
        totalVisitsAllLocations: (g.metrics || []).reduce((s: number, m: any) => s + (m.total_visits || 0), 0),
      }));

      return { guests, total: count || 0 };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      return searchGuests(input.query);
    }),

  getProfile: protectedProcedure
    .input(z.object({ guestId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getGuestProfile(input.guestId);
    }),

  update: protectedProcedure
    .input(updateGuestSchema)
    .mutation(async ({ input }) => {
      const { guestId, ...data } = input;
      return updateGuest(guestId, data);
    }),

  addNote: protectedProcedure
    .input(addGuestNoteSchema)
    .mutation(async ({ input, ctx }) => {
      return addNote(input.guestId, ctx.session.id, input.content, input.flagged);
    }),

  addTag: protectedProcedure
    .input(addGuestTagSchema)
    .mutation(async ({ input, ctx }) => {
      return addTag(input.guestId, input.tag, ctx.session.id);
    }),

  removeTag: protectedProcedure
    .input(removeGuestTagSchema)
    .mutation(async ({ input }) => {
      return removeTag(input.guestId, input.tag);
    }),

  merge: roleProcedure("admin", "manager")
    .input(mergeGuestsSchema)
    .mutation(async ({ input }) => {
      return mergeGuests(input.primaryGuestId, input.duplicateGuestId);
    }),
});
