import { db } from "@/lib/db";
import {
  reservations,
  guests,
  visits,
  tables,
  guestMetrics,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateToken, normalizePhone } from "@/lib/utils";
import { getAvailableSlots } from "./availability";
import type {
  CreateReservationInput,
  UpdateReservationInput,
} from "@/lib/validators/reservation";

export async function createReservation(input: CreateReservationInput) {
  const phone = normalizePhone(input.phone);

  // Verify slot is still available
  const slots = await getAvailableSlots({
    locationId: input.locationId,
    date: input.date,
    partySize: input.partySize,
  });
  const targetSlot = slots.find((s) => s.time === input.time);
  if (!targetSlot?.available) {
    throw new Error("SLOT_UNAVAILABLE");
  }

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
        email: input.email || null,
      })
      .returning();
    guest = newGuest;
  }

  // Check for duplicate: same guest, same date, same location, active status
  const existingReservation = await db.query.reservations.findFirst({
    where: and(
      eq(reservations.guestId, guest.id),
      eq(reservations.locationId, input.locationId),
      eq(reservations.date, input.date),
      sql`${reservations.status} NOT IN ('cancelled', 'no_show', 'completed')`
    ),
  });

  if (existingReservation) {
    throw new Error("DUPLICATE_RESERVATION");
  }

  const token = generateToken();

  const [reservation] = await db
    .insert(reservations)
    .values({
      locationId: input.locationId,
      guestId: guest.id,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      source: input.source,
      specialRequests: input.specialRequests || null,
      confirmationToken: token,
    })
    .returning();

  return { reservation, guest, token };
}

export async function cancelReservation(
  reservationId: string,
  token?: string
) {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
  });

  if (!reservation) throw new Error("NOT_FOUND");

  // If cancelling via guest link, verify token
  if (token && reservation.confirmationToken !== token) {
    throw new Error("INVALID_TOKEN");
  }

  if (reservation.status === "cancelled") {
    throw new Error("ALREADY_CANCELLED");
  }

  if (reservation.status === "seated" || reservation.status === "completed") {
    throw new Error("CANNOT_CANCEL");
  }

  const [updated] = await db
    .update(reservations)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  return updated;
}

export async function updateReservation(input: UpdateReservationInput) {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, input.reservationId),
  });

  if (!reservation) throw new Error("NOT_FOUND");
  if (reservation.status === "cancelled" || reservation.status === "completed") {
    throw new Error("CANNOT_MODIFY");
  }

  // If changing date/time/party size, verify new slot availability
  const newDate = input.date || reservation.date;
  const newTime = input.time || reservation.time;
  const newPartySize = input.partySize || reservation.partySize;

  if (input.date || input.time || input.partySize) {
    const slots = await getAvailableSlots({
      locationId: reservation.locationId,
      date: newDate,
      partySize: newPartySize,
    });
    const targetSlot = slots.find((s) => s.time === newTime.slice(0, 5));
    // Add back current reservation's covers when checking availability
    if (
      targetSlot &&
      !targetSlot.available &&
      !(newDate === reservation.date && newTime === reservation.time)
    ) {
      throw new Error("SLOT_UNAVAILABLE");
    }
  }

  const [updated] = await db
    .update(reservations)
    .set({
      ...(input.date && { date: input.date }),
      ...(input.time && { time: input.time }),
      ...(input.partySize && { partySize: input.partySize }),
      ...(input.specialRequests !== undefined && {
        specialRequests: input.specialRequests || null,
      }),
      ...(input.tableId !== undefined && { tableId: input.tableId }),
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, input.reservationId))
    .returning();

  return updated;
}

export async function seatReservation(
  reservationId: string,
  tableId: string
) {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
  });

  if (!reservation) throw new Error("NOT_FOUND");
  if (reservation.status === "seated") throw new Error("ALREADY_SEATED");
  if (reservation.status === "cancelled" || reservation.status === "no_show") {
    throw new Error("CANNOT_SEAT");
  }

  const now = new Date();

  // Update reservation
  const [updated] = await db
    .update(reservations)
    .set({
      status: "seated",
      tableId,
      seatedAt: now,
      updatedAt: now,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  // Mark table as occupied
  await db
    .update(tables)
    .set({ status: "occupied" })
    .where(eq(tables.id, tableId));

  // Create visit record
  await db.insert(visits).values({
    guestId: reservation.guestId,
    locationId: reservation.locationId,
    reservationId: reservation.id,
    tableId,
    partySize: reservation.partySize,
    seatedAt: now,
  });

  // Update guest metrics
  await updateGuestMetrics(reservation.guestId, reservation.locationId);

  return updated;
}

export async function completeReservation(reservationId: string) {
  const now = new Date();

  const [updated] = await db
    .update(reservations)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  // Mark table as turning
  if (updated.tableId) {
    await db
      .update(tables)
      .set({ status: "turning" })
      .where(eq(tables.id, updated.tableId));
  }

  // Complete the visit
  await db
    .update(visits)
    .set({ completedAt: now })
    .where(eq(visits.reservationId, reservationId));

  return updated;
}

export async function markNoShow(reservationId: string) {
  const now = new Date();

  const [updated] = await db
    .update(reservations)
    .set({
      status: "no_show",
      noShowAt: now,
      updatedAt: now,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  // Increment no-show count in guest metrics
  await db
    .update(guestMetrics)
    .set({
      noShowCount: sql`${guestMetrics.noShowCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(guestMetrics.guestId, updated.guestId),
        eq(guestMetrics.locationId, updated.locationId)
      )
    );

  return updated;
}

export async function getReservationsByDate(
  locationId: string,
  date: string
) {
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.locationId, locationId),
      eq(reservations.date, date)
    ),
    with: {
      guest: {
        with: {
          tags: true,
        },
      },
      table: true,
    },
    orderBy: (r, { asc }) => [asc(r.time)],
  });
}

export async function getReservationByToken(token: string) {
  return db.query.reservations.findFirst({
    where: eq(reservations.confirmationToken, token),
    with: {
      guest: true,
      location: true,
    },
  });
}

async function updateGuestMetrics(guestId: string, locationId: string) {
  const visitData = await db
    .select({
      count: sql<number>`count(*)::int`,
      avgParty: sql<number>`avg(${visits.partySize})::real`,
      firstVisit: sql<Date>`min(${visits.seatedAt})`,
      lastVisit: sql<Date>`max(${visits.seatedAt})`,
    })
    .from(visits)
    .where(
      and(eq(visits.guestId, guestId), eq(visits.locationId, locationId))
    );

  const stats = visitData[0];

  await db
    .insert(guestMetrics)
    .values({
      guestId,
      locationId,
      totalVisits: stats.count,
      avgPartySize: stats.avgParty,
      firstVisitAt: stats.firstVisit,
      lastVisitAt: stats.lastVisit,
    })
    .onConflictDoUpdate({
      target: [guestMetrics.guestId, guestMetrics.locationId],
      set: {
        totalVisits: stats.count,
        avgPartySize: stats.avgParty,
        firstVisitAt: stats.firstVisit,
        lastVisitAt: stats.lastVisit,
        updatedAt: new Date(),
      },
    });
}
