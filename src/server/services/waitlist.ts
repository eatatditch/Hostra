import { db } from "@/lib/db";
import {
  waitlistEntries,
  guests,
  tables,
  visits,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { generateToken, normalizePhone } from "@/lib/utils";
import type { JoinWaitlistInput } from "@/lib/validators/waitlist";

const AVG_TURN_TIME_MINUTES = 45;

export async function joinWaitlist(input: JoinWaitlistInput) {
  const phone = normalizePhone(input.phone);

  // Find or create guest
  let guest = await db.query.guests.findFirst({
    where: eq(guests.phone, phone),
  });

  if (!guest) {
    const [newGuest] = await db
      .insert(guests)
      .values({
        phone,
        firstName: input.firstName,
        lastName: input.lastName || null,
      })
      .returning();
    guest = newGuest;
  }

  // Check if guest is already on the waitlist
  const existing = await db.query.waitlistEntries.findFirst({
    where: and(
      eq(waitlistEntries.guestId, guest.id),
      eq(waitlistEntries.locationId, input.locationId),
      eq(waitlistEntries.status, "waiting")
    ),
  });

  if (existing) {
    throw new Error("ALREADY_ON_WAITLIST");
  }

  // Get current max position
  const [maxPos] = await db
    .select({
      maxPosition: sql<number>`coalesce(max(${waitlistEntries.position}), 0)::int`,
    })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.locationId, input.locationId),
        eq(waitlistEntries.status, "waiting")
      )
    );

  const position = maxPos.maxPosition + 1;
  const estimatedWait = await estimateWaitTime(
    input.locationId,
    input.partySize,
    position
  );

  const token = generateToken();

  const [entry] = await db
    .insert(waitlistEntries)
    .values({
      locationId: input.locationId,
      guestId: guest.id,
      partySize: input.partySize,
      position,
      estimatedWaitMinutes: estimatedWait,
      source: input.source,
      checkToken: token,
    })
    .returning();

  return { entry, guest, token };
}

export async function notifyWaitlistEntry(entryId: string) {
  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.id, entryId),
  });

  if (!entry) throw new Error("NOT_FOUND");
  if (entry.status !== "waiting") throw new Error("NOT_WAITING");

  const [updated] = await db
    .update(waitlistEntries)
    .set({
      status: "notified",
      notifiedAt: new Date(),
    })
    .where(eq(waitlistEntries.id, entryId))
    .returning();

  return updated;
}

export async function seatWaitlistEntry(entryId: string, tableId: string) {
  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.id, entryId),
  });

  if (!entry) throw new Error("NOT_FOUND");
  if (entry.status !== "waiting" && entry.status !== "notified") {
    throw new Error("CANNOT_SEAT");
  }

  const now = new Date();

  const [updated] = await db
    .update(waitlistEntries)
    .set({
      status: "seated",
      tableId,
      seatedAt: now,
    })
    .where(eq(waitlistEntries.id, entryId))
    .returning();

  // Mark table occupied
  await db
    .update(tables)
    .set({ status: "occupied" })
    .where(eq(tables.id, tableId));

  // Create visit record
  await db.insert(visits).values({
    guestId: entry.guestId,
    locationId: entry.locationId,
    waitlistEntryId: entry.id,
    tableId,
    partySize: entry.partySize,
    seatedAt: now,
  });

  // Recalculate positions for remaining entries
  await recalculatePositions(entry.locationId);

  return updated;
}

export async function removeWaitlistEntry(entryId: string) {
  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.id, entryId),
  });

  if (!entry) throw new Error("NOT_FOUND");
  if (entry.status === "seated") throw new Error("ALREADY_SEATED");

  const [updated] = await db
    .update(waitlistEntries)
    .set({
      status: "removed",
      removedAt: new Date(),
    })
    .where(eq(waitlistEntries.id, entryId))
    .returning();

  await recalculatePositions(entry.locationId);

  return updated;
}

export async function getActiveWaitlist(locationId: string) {
  return db.query.waitlistEntries.findMany({
    where: and(
      eq(waitlistEntries.locationId, locationId),
      sql`${waitlistEntries.status} IN ('waiting', 'notified')`
    ),
    with: {
      guest: {
        with: {
          tags: true,
        },
      },
    },
    orderBy: (w, { asc }) => [asc(w.position)],
  });
}

export async function getWaitlistByToken(token: string) {
  return db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.checkToken, token),
    with: {
      guest: true,
    },
  });
}

async function recalculatePositions(locationId: string) {
  const active = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.locationId, locationId),
        eq(waitlistEntries.status, "waiting")
      )
    )
    .orderBy(waitlistEntries.createdAt);

  for (let i = 0; i < active.length; i++) {
    await db
      .update(waitlistEntries)
      .set({
        position: i + 1,
        estimatedWaitMinutes: await estimateWaitTime(
          locationId,
          0, // party size not needed for position-based estimate
          i + 1
        ),
      })
      .where(eq(waitlistEntries.id, active[i].id));
  }
}

async function estimateWaitTime(
  locationId: string,
  _partySize: number,
  position: number
): Promise<number> {
  // Get average turn time from recent visits
  const [recent] = await db
    .select({
      avgTurn: sql<number>`
        coalesce(
          avg(extract(epoch from (${visits.completedAt} - ${visits.seatedAt})) / 60)::int,
          ${AVG_TURN_TIME_MINUTES}
        )
      `,
    })
    .from(visits)
    .where(
      and(
        eq(visits.locationId, locationId),
        sql`${visits.completedAt} IS NOT NULL`,
        sql`${visits.seatedAt} > now() - interval '7 days'`
      )
    );

  const avgTurn = recent?.avgTurn || AVG_TURN_TIME_MINUTES;

  // Get number of currently occupied tables
  const [tableData] = await db
    .select({
      occupiedCount: sql<number>`count(*)::int`,
    })
    .from(tables)
    .where(
      and(
        eq(tables.locationId, locationId),
        eq(tables.status, "occupied")
      )
    );

  const occupiedTables = tableData?.occupiedCount || 1;

  // Estimate: position in queue * avg turn time / number of tables turning
  return Math.max(5, Math.round((position * avgTurn) / Math.max(occupiedTables, 1)));
}
