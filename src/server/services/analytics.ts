import { db } from "@/lib/db";
import {
  reservations,
  waitlistEntries,
  visits,
  triggerEvents,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface DailySummary {
  date: string;
  totalReservations: number;
  seatedCount: number;
  noShowCount: number;
  cancelledCount: number;
  totalCovers: number;
  waitlistJoins: number;
  waitlistSeated: number;
  triggersTotal: number;
  triggersActioned: number;
  avgPartySize: number;
}

export async function getDailySummary(
  locationId: string,
  date: string
): Promise<DailySummary> {
  const [resStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      seated: sql<number>`count(*) filter (where ${reservations.status} IN ('seated', 'completed'))::int`,
      noShow: sql<number>`count(*) filter (where ${reservations.status} = 'no_show')::int`,
      cancelled: sql<number>`count(*) filter (where ${reservations.status} = 'cancelled')::int`,
      totalCovers: sql<number>`coalesce(sum(${reservations.partySize}) filter (where ${reservations.status} IN ('seated', 'completed')), 0)::int`,
      avgParty: sql<number>`coalesce(avg(${reservations.partySize})::real, 0)`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.locationId, locationId),
        eq(reservations.date, date)
      )
    );

  const [waitlistStats] = await db
    .select({
      joins: sql<number>`count(*)::int`,
      seated: sql<number>`count(*) filter (where ${waitlistEntries.status} = 'seated')::int`,
    })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.locationId, locationId),
        sql`${waitlistEntries.createdAt}::date = ${date}::date`
      )
    );

  const [triggerStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      actioned: sql<number>`count(*) filter (where ${triggerEvents.actioned} = true)::int`,
    })
    .from(triggerEvents)
    .where(
      and(
        eq(triggerEvents.locationId, locationId),
        sql`${triggerEvents.createdAt}::date = ${date}::date`
      )
    );

  return {
    date,
    totalReservations: resStats.total,
    seatedCount: resStats.seated,
    noShowCount: resStats.noShow,
    cancelledCount: resStats.cancelled,
    totalCovers: resStats.totalCovers,
    avgPartySize: resStats.avgParty,
    waitlistJoins: waitlistStats.joins,
    waitlistSeated: waitlistStats.seated,
    triggersTotal: triggerStats.total,
    triggersActioned: triggerStats.actioned,
  };
}

export async function getWeeklyTrend(
  locationId: string,
  endDate: string
) {
  const rows = await db
    .select({
      date: reservations.date,
      covers: sql<number>`coalesce(sum(${reservations.partySize}) filter (where ${reservations.status} IN ('seated', 'completed')), 0)::int`,
      reservations: sql<number>`count(*)::int`,
      noShows: sql<number>`count(*) filter (where ${reservations.status} = 'no_show')::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.locationId, locationId),
        sql`${reservations.date}::date > ${endDate}::date - interval '7 days'`,
        sql`${reservations.date}::date <= ${endDate}::date`
      )
    )
    .groupBy(reservations.date)
    .orderBy(reservations.date);

  return rows;
}
