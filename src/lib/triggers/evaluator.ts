import { db } from "@/lib/db";
import {
  guests,
  guestTags,
  guestNotes,
  guestMetrics,
  triggerConfigs,
  reservations,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { differenceInDays, parse } from "date-fns";
import { TriggerType, TriggerSeverity } from "@/types";
import type { TriggerResult } from "@/types";

interface EvaluationContext {
  guestId: string;
  locationId: string;
  reservationId?: string;
  partySize: number;
  specialRequests?: string | null;
  date: string;
}

type TriggerEvaluator = (ctx: EvaluationContext) => Promise<TriggerResult | null>;

const evaluators: Record<string, TriggerEvaluator> = {
  [TriggerType.BIRTHDAY]: async (ctx) => {
    const guest = await db.query.guests.findFirst({
      where: eq(guests.id, ctx.guestId),
    });
    if (!guest?.dateOfBirth) return null;

    const dob = parse(guest.dateOfBirth, "yyyy-MM-dd", new Date());
    const resDate = parse(ctx.date, "yyyy-MM-dd", new Date());

    // Set DOB to current year for comparison
    const thisYearBirthday = new Date(
      resDate.getFullYear(),
      dob.getMonth(),
      dob.getDate()
    );
    const daysDiff = Math.abs(differenceInDays(resDate, thisYearBirthday));

    if (daysDiff <= 3) {
      return {
        type: TriggerType.BIRTHDAY,
        severity: TriggerSeverity.ACTION,
        message:
          daysDiff === 0
            ? "Today is their birthday!"
            : `Birthday is ${daysDiff} day${daysDiff > 1 ? "s" : ""} away`,
        payload: { dateOfBirth: guest.dateOfBirth, daysDiff },
      };
    }
    return null;
  },

  [TriggerType.ANNIVERSARY]: async (ctx) => {
    const guest = await db.query.guests.findFirst({
      where: eq(guests.id, ctx.guestId),
    });
    if (!guest?.anniversaryDate) return null;

    const anniv = parse(guest.anniversaryDate, "yyyy-MM-dd", new Date());
    const resDate = parse(ctx.date, "yyyy-MM-dd", new Date());

    const thisYearAnniv = new Date(
      resDate.getFullYear(),
      anniv.getMonth(),
      anniv.getDate()
    );
    const daysDiff = Math.abs(differenceInDays(resDate, thisYearAnniv));

    if (daysDiff <= 3) {
      return {
        type: TriggerType.ANNIVERSARY,
        severity: TriggerSeverity.ACTION,
        message:
          daysDiff === 0
            ? "Anniversary today!"
            : `Anniversary is ${daysDiff} day${daysDiff > 1 ? "s" : ""} away`,
        payload: { anniversaryDate: guest.anniversaryDate, daysDiff },
      };
    }
    return null;
  },

  [TriggerType.FIRST_VISIT]: async (ctx) => {
    const metrics = await db.query.guestMetrics.findFirst({
      where: and(
        eq(guestMetrics.guestId, ctx.guestId),
        eq(guestMetrics.locationId, ctx.locationId)
      ),
    });

    if (!metrics || metrics.totalVisits === 0) {
      return {
        type: TriggerType.FIRST_VISIT,
        severity: TriggerSeverity.ACTION,
        message: "First time visiting this location",
        payload: {},
      };
    }
    return null;
  },

  [TriggerType.RETURNING_AFTER_ABSENCE]: async (ctx) => {
    const config = await getConfig(ctx.locationId, TriggerType.RETURNING_AFTER_ABSENCE);
    const thresholdDays = (config?.threshold as Record<string, number>)?.days || 90;

    const metrics = await db.query.guestMetrics.findFirst({
      where: and(
        eq(guestMetrics.guestId, ctx.guestId),
        eq(guestMetrics.locationId, ctx.locationId)
      ),
    });

    if (metrics?.lastVisitAt && metrics.totalVisits > 0) {
      const daysSince = differenceInDays(new Date(), metrics.lastVisitAt);
      if (daysSince >= thresholdDays) {
        return {
          type: TriggerType.RETURNING_AFTER_ABSENCE,
          severity: TriggerSeverity.ACTION,
          message: `Returning after ${daysSince} days`,
          payload: { daysSinceLastVisit: daysSince, lastVisitAt: metrics.lastVisitAt },
        };
      }
    }
    return null;
  },

  [TriggerType.VIP]: async (ctx) => {
    const tags = await db.query.guestTags.findMany({
      where: eq(guestTags.guestId, ctx.guestId),
    });

    if (tags.some((t) => t.tag.toLowerCase() === "vip")) {
      return {
        type: TriggerType.VIP,
        severity: TriggerSeverity.CRITICAL,
        message: "VIP guest",
        payload: {},
      };
    }
    return null;
  },

  [TriggerType.HIGH_FREQUENCY]: async (ctx) => {
    const config = await getConfig(ctx.locationId, TriggerType.HIGH_FREQUENCY);
    const threshold = (config?.threshold as Record<string, number>)?.visitsPerMonth || 4;

    const [recent] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.guestId, ctx.guestId),
          eq(reservations.locationId, ctx.locationId),
          sql`${reservations.status} IN ('seated', 'completed')`,
          sql`${reservations.date}::date > current_date - interval '30 days'`
        )
      );

    if (recent.count >= threshold) {
      return {
        type: TriggerType.HIGH_FREQUENCY,
        severity: TriggerSeverity.INFO,
        message: `${recent.count} visits in the last 30 days`,
        payload: { recentVisitCount: recent.count },
      };
    }
    return null;
  },

  [TriggerType.NO_SHOW_RISK]: async (ctx) => {
    const metrics = await db.query.guestMetrics.findFirst({
      where: and(
        eq(guestMetrics.guestId, ctx.guestId),
        eq(guestMetrics.locationId, ctx.locationId)
      ),
    });

    if (metrics && metrics.noShowCount >= 2) {
      return {
        type: TriggerType.NO_SHOW_RISK,
        severity: TriggerSeverity.CRITICAL,
        message: `${metrics.noShowCount} prior no-shows`,
        payload: { noShowCount: metrics.noShowCount },
      };
    }
    return null;
  },

  [TriggerType.PREFERRED_SEATING]: async (ctx) => {
    // Check guest notes for seating preferences
    const notes = await db.query.guestNotes.findMany({
      where: eq(guestNotes.guestId, ctx.guestId),
    });

    const seatNotes = notes.filter(
      (n) =>
        n.content.toLowerCase().includes("seat") ||
        n.content.toLowerCase().includes("table") ||
        n.content.toLowerCase().includes("booth") ||
        n.content.toLowerCase().includes("patio") ||
        n.content.toLowerCase().includes("bar")
    );

    if (seatNotes.length > 0) {
      return {
        type: TriggerType.PREFERRED_SEATING,
        severity: TriggerSeverity.INFO,
        message: "Has seating preferences",
        payload: { notes: seatNotes.map((n) => n.content) },
      };
    }
    return null;
  },

  [TriggerType.PRIOR_ISSUE]: async (ctx) => {
    const flaggedNotes = await db.query.guestNotes.findMany({
      where: and(
        eq(guestNotes.guestId, ctx.guestId),
        eq(guestNotes.flagged, true)
      ),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 1,
    });

    if (flaggedNotes.length > 0) {
      return {
        type: TriggerType.PRIOR_ISSUE,
        severity: TriggerSeverity.CRITICAL,
        message: "Prior issue flagged",
        payload: { note: flaggedNotes[0].content },
      };
    }
    return null;
  },

  [TriggerType.MILESTONE_VISIT]: async (ctx) => {
    const metrics = await db.query.guestMetrics.findFirst({
      where: and(
        eq(guestMetrics.guestId, ctx.guestId),
        eq(guestMetrics.locationId, ctx.locationId)
      ),
    });

    const milestones = [5, 10, 25, 50, 100];
    if (metrics) {
      const nextVisitCount = metrics.totalVisits + 1;
      if (milestones.includes(nextVisitCount)) {
        return {
          type: TriggerType.MILESTONE_VISIT,
          severity: TriggerSeverity.ACTION,
          message: `Visit #${nextVisitCount}!`,
          payload: { visitNumber: nextVisitCount },
        };
      }
    }
    return null;
  },

  [TriggerType.LARGE_PARTY]: async (ctx) => {
    const config = await getConfig(ctx.locationId, TriggerType.LARGE_PARTY);
    const threshold = (config?.threshold as Record<string, number>)?.minSize || 6;

    if (ctx.partySize >= threshold) {
      return {
        type: TriggerType.LARGE_PARTY,
        severity: TriggerSeverity.INFO,
        message: `Large party of ${ctx.partySize}`,
        payload: { partySize: ctx.partySize },
      };
    }
    return null;
  },

  [TriggerType.SPECIAL_REQUEST]: async (ctx) => {
    if (ctx.specialRequests && ctx.specialRequests.trim().length > 0) {
      return {
        type: TriggerType.SPECIAL_REQUEST,
        severity: TriggerSeverity.INFO,
        message: "Has special requests",
        payload: { request: ctx.specialRequests },
      };
    }
    return null;
  },
};

async function getConfig(locationId: string, triggerType: string) {
  return db.query.triggerConfigs.findFirst({
    where: and(
      eq(triggerConfigs.locationId, locationId),
      eq(triggerConfigs.triggerType, triggerType as any)
    ),
  });
}

export async function evaluateTriggers(
  ctx: EvaluationContext
): Promise<TriggerResult[]> {
  // Get enabled triggers for this location
  const configs = await db.query.triggerConfigs.findMany({
    where: eq(triggerConfigs.locationId, ctx.locationId),
  });

  const enabledTypes = new Set<string>();
  const allTypes = Object.keys(evaluators);

  // If no configs exist, all triggers are enabled by default
  if (configs.length === 0) {
    allTypes.forEach((t) => enabledTypes.add(t));
  } else {
    for (const config of configs) {
      if (config.enabled) {
        enabledTypes.add(config.triggerType);
      }
    }
    // Types not in config are enabled by default
    for (const type of allTypes) {
      if (!configs.find((c) => c.triggerType === type)) {
        enabledTypes.add(type);
      }
    }
  }

  const results: TriggerResult[] = [];

  for (const type of enabledTypes) {
    const evaluator = evaluators[type];
    if (!evaluator) continue;

    try {
      const result = await evaluator(ctx);
      if (result) results.push(result);
    } catch {
      // Silently skip failed evaluators — don't block the host
    }
  }

  // Sort by severity: critical > action > info
  const severityOrder = { critical: 0, action: 1, info: 2 };
  results.sort(
    (a, b) =>
      (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) -
      (severityOrder[b.severity as keyof typeof severityOrder] ?? 3)
  );

  return results;
}
