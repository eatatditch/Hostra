import { supabase } from "@/lib/db";

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
  // Fetch all reservations for the date
  const { data: resList, error: resErr } = await supabase
    .from("reservations")
    .select("status, party_size")
    .eq("location_id", locationId)
    .eq("date", date);

  if (resErr) throw new Error(resErr.message);
  const rows = resList || [];

  const total = rows.length;
  const seated = rows.filter(
    (r) => r.status === "seated" || r.status === "completed"
  ).length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const totalCovers = rows
    .filter((r) => r.status === "seated" || r.status === "completed")
    .reduce((sum, r) => sum + (r.party_size || 0), 0);
  const avgPartySize =
    total > 0
      ? rows.reduce((sum, r) => sum + (r.party_size || 0), 0) / total
      : 0;

  // Fetch waitlist entries created on this date
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data: waitlistRows, error: wlErr } = await supabase
    .from("waitlist_entries")
    .select("status")
    .eq("location_id", locationId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (wlErr) throw new Error(wlErr.message);
  const wl = waitlistRows || [];

  const waitlistJoins = wl.length;
  const waitlistSeated = wl.filter((w) => w.status === "seated").length;

  // Fetch trigger events created on this date
  const { data: triggerRows, error: tErr } = await supabase
    .from("trigger_events")
    .select("actioned")
    .eq("location_id", locationId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (tErr) throw new Error(tErr.message);
  const triggers = triggerRows || [];

  const triggersTotal = triggers.length;
  const triggersActioned = triggers.filter((t) => t.actioned === true).length;

  return {
    date,
    totalReservations: total,
    seatedCount: seated,
    noShowCount: noShow,
    cancelledCount: cancelled,
    totalCovers,
    avgPartySize,
    waitlistJoins,
    waitlistSeated,
    triggersTotal,
    triggersActioned,
  };
}

export async function getWeeklyTrend(
  locationId: string,
  endDate: string
) {
  // Calculate start date (7 days before endDate)
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startDate = start.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("reservations")
    .select("date, party_size, status")
    .eq("location_id", locationId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw new Error(error.message);

  // Group by date and aggregate
  const byDate = new Map<
    string,
    { covers: number; reservations: number; noShows: number }
  >();

  for (const row of rows || []) {
    const d = row.date;
    if (!byDate.has(d)) {
      byDate.set(d, { covers: 0, reservations: 0, noShows: 0 });
    }
    const entry = byDate.get(d)!;
    entry.reservations += 1;
    if (row.status === "seated" || row.status === "completed") {
      entry.covers += row.party_size || 0;
    }
    if (row.status === "no_show") {
      entry.noShows += 1;
    }
  }

  // Sort by date and return
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      covers: stats.covers,
      reservations: stats.reservations,
      noShows: stats.noShows,
    }));
}
