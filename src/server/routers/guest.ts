import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
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
