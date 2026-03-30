import { db } from "@/lib/db";
import {
  guests,
  guestTags,
  guestNotes,
  guestMetrics,
  reservations,
  waitlistEntries,
  visits,
  communications,
  triggerEvents,
} from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";

export async function searchGuests(query: string, locationId: string) {
  return db.query.guests.findMany({
    where: or(
      ilike(guests.firstName, `%${query}%`),
      ilike(guests.lastName, `%${query}%`),
      ilike(guests.phone, `%${query}%`),
      ilike(guests.email, `%${query}%`)
    ),
    with: {
      tags: true,
      metrics: {
        where: eq(guestMetrics.locationId, locationId),
      },
    },
    limit: 25,
  });
}

export async function getGuestProfile(guestId: string, locationId: string) {
  const guest = await db.query.guests.findFirst({
    where: eq(guests.id, guestId),
    with: {
      tags: true,
      notes: {
        orderBy: (n, { desc }) => [desc(n.createdAt)],
        limit: 50,
      },
      metrics: {
        where: eq(guestMetrics.locationId, locationId),
      },
    },
  });

  if (!guest) return null;

  // Get visit history for this location
  const visitHistory = await db.query.visits.findMany({
    where: and(
      eq(visits.guestId, guestId),
      eq(visits.locationId, locationId)
    ),
    with: {
      table: true,
    },
    orderBy: (v, { desc }) => [desc(v.seatedAt)],
    limit: 50,
  });

  // Get communication history
  const commHistory = await db.query.communications.findMany({
    where: and(
      eq(communications.guestId, guestId),
      eq(communications.locationId, locationId)
    ),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    limit: 50,
  });

  // Get trigger history
  const triggerHistory = await db.query.triggerEvents.findMany({
    where: and(
      eq(triggerEvents.guestId, guestId),
      eq(triggerEvents.locationId, locationId)
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  });

  return {
    ...guest,
    visits: visitHistory,
    communications: commHistory,
    triggers: triggerHistory,
  };
}

export async function updateGuest(
  guestId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string | null;
    anniversaryDate?: string | null;
    dietaryRestrictions?: string | null;
    allergies?: string | null;
  }
) {
  const [updated] = await db
    .update(guests)
    .set({
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
      ...(data.anniversaryDate !== undefined && {
        anniversaryDate: data.anniversaryDate,
      }),
      ...(data.dietaryRestrictions !== undefined && {
        dietaryRestrictions: data.dietaryRestrictions,
      }),
      ...(data.allergies !== undefined && { allergies: data.allergies }),
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId))
    .returning();

  return updated;
}

export async function addNote(
  guestId: string,
  staffId: string,
  content: string,
  flagged = false
) {
  const [note] = await db
    .insert(guestNotes)
    .values({ guestId, staffId, content, flagged })
    .returning();
  return note;
}

export async function addTag(guestId: string, tag: string, staffId: string) {
  const [result] = await db
    .insert(guestTags)
    .values({ guestId, tag, createdBy: staffId })
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function removeTag(guestId: string, tag: string) {
  await db
    .delete(guestTags)
    .where(and(eq(guestTags.guestId, guestId), eq(guestTags.tag, tag)));
}

export async function mergeGuests(
  primaryId: string,
  duplicateId: string
) {
  // Move all references from duplicate to primary
  await db
    .update(reservations)
    .set({ guestId: primaryId })
    .where(eq(reservations.guestId, duplicateId));

  await db
    .update(waitlistEntries)
    .set({ guestId: primaryId })
    .where(eq(waitlistEntries.guestId, duplicateId));

  await db
    .update(visits)
    .set({ guestId: primaryId })
    .where(eq(visits.guestId, duplicateId));

  await db
    .update(communications)
    .set({ guestId: primaryId })
    .where(eq(communications.guestId, duplicateId));

  await db
    .update(triggerEvents)
    .set({ guestId: primaryId })
    .where(eq(triggerEvents.guestId, duplicateId));

  // Move notes (skip tag conflicts)
  await db
    .update(guestNotes)
    .set({ guestId: primaryId })
    .where(eq(guestNotes.guestId, duplicateId));

  // Delete duplicate's tags (primary keeps theirs)
  await db.delete(guestTags).where(eq(guestTags.guestId, duplicateId));

  // Delete duplicate's metrics
  await db.delete(guestMetrics).where(eq(guestMetrics.guestId, duplicateId));

  // Delete duplicate guest
  await db.delete(guests).where(eq(guests.id, duplicateId));

  return { merged: true, primaryId };
}
