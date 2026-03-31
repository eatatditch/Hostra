import { supabase } from "@/lib/db";
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
    const { data: guest } = await supabase
      .from("guests")
      .select("date_of_birth")
      .eq("id", ctx.guestId)
      .single();

    if (!guest?.date_of_birth) return null;

    const dob = parse(guest.date_of_birth, "yyyy-MM-dd", new Date());
    const resDate = parse(ctx.date, "yyyy-MM-dd", new Date());

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
        payload: { dateOfBirth: guest.date_of_birth, daysDiff },
      };
    }
    return null;
  },

  [TriggerType.ANNIVERSARY]: async (ctx) => {
    const { data: guest } = await supabase
      .from("guests")
      .select("anniversary_date")
      .eq("id", ctx.guestId)
      .single();

    if (!guest?.anniversary_date) return null;

    const anniv = parse(guest.anniversary_date, "yyyy-MM-dd", new Date());
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
        payload: { anniversaryDate: guest.anniversary_date, daysDiff },
      };
    }
    return null;
  },

  [TriggerType.FIRST_VISIT]: async (ctx) => {
    const { data: metrics } = await supabase
      .from("guest_metrics")
      .select("total_visits")
      .eq("guest_id", ctx.guestId)
      .eq("location_id", ctx.locationId)
      .single();

    if (!metrics || metrics.total_visits === 0) {
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

    const { data: metrics } = await supabase
      .from("guest_metrics")
      .select("total_visits, last_visit_at")
      .eq("guest_id", ctx.guestId)
      .eq("location_id", ctx.locationId)
      .single();

    if (metrics?.last_visit_at && metrics.total_visits > 0) {
      const daysSince = differenceInDays(new Date(), new Date(metrics.last_visit_at));
      if (daysSince >= thresholdDays) {
        return {
          type: TriggerType.RETURNING_AFTER_ABSENCE,
          severity: TriggerSeverity.ACTION,
          message: `Returning after ${daysSince} days`,
          payload: { daysSinceLastVisit: daysSince, lastVisitAt: metrics.last_visit_at },
        };
      }
    }
    return null;
  },

  [TriggerType.VIP]: async (ctx) => {
    const { data: tags } = await supabase
      .from("guest_tags")
      .select("tag")
      .eq("guest_id", ctx.guestId);

    if (tags && tags.some((t) => t.tag.toLowerCase() === "vip")) {
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().slice(0, 10);

    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("guest_id", ctx.guestId)
      .eq("location_id", ctx.locationId)
      .in("status", ["seated", "completed"])
      .gte("date", cutoffDate);

    const recentCount = count || 0;

    if (recentCount >= threshold) {
      return {
        type: TriggerType.HIGH_FREQUENCY,
        severity: TriggerSeverity.INFO,
        message: `${recentCount} visits in the last 30 days`,
        payload: { recentVisitCount: recentCount },
      };
    }
    return null;
  },

  [TriggerType.NO_SHOW_RISK]: async (ctx) => {
    const { data: metrics } = await supabase
      .from("guest_metrics")
      .select("no_show_count")
      .eq("guest_id", ctx.guestId)
      .eq("location_id", ctx.locationId)
      .single();

    if (metrics && metrics.no_show_count >= 2) {
      return {
        type: TriggerType.NO_SHOW_RISK,
        severity: TriggerSeverity.CRITICAL,
        message: `${metrics.no_show_count} prior no-shows`,
        payload: { noShowCount: metrics.no_show_count },
      };
    }
    return null;
  },

  [TriggerType.PREFERRED_SEATING]: async (ctx) => {
    const { data: notes } = await supabase
      .from("guest_notes")
      .select("content")
      .eq("guest_id", ctx.guestId);

    const seatNotes = (notes || []).filter(
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
    const { data: flaggedNotes } = await supabase
      .from("guest_notes")
      .select("content")
      .eq("guest_id", ctx.guestId)
      .eq("flagged", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (flaggedNotes && flaggedNotes.length > 0) {
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
    const { data: metrics } = await supabase
      .from("guest_metrics")
      .select("total_visits")
      .eq("guest_id", ctx.guestId)
      .eq("location_id", ctx.locationId)
      .single();

    const milestones = [5, 10, 25, 50, 100];
    if (metrics) {
      const nextVisitCount = metrics.total_visits + 1;
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
  const { data } = await supabase
    .from("trigger_configs")
    .select("*")
    .eq("location_id", locationId)
    .eq("trigger_type", triggerType)
    .single();

  return data;
}

export async function evaluateTriggers(
  ctx: EvaluationContext
): Promise<TriggerResult[]> {
  // Get enabled triggers for this location
  const { data: configs } = await supabase
    .from("trigger_configs")
    .select("*")
    .eq("location_id", ctx.locationId);

  const configList = configs || [];
  const enabledTypes = new Set<string>();
  const allTypes = Object.keys(evaluators);

  // If no configs exist, all triggers are enabled by default
  if (configList.length === 0) {
    allTypes.forEach((t) => enabledTypes.add(t));
  } else {
    for (const config of configList) {
      if (config.enabled) {
        enabledTypes.add(config.trigger_type);
      }
    }
    // Types not in config are enabled by default
    for (const type of allTypes) {
      if (!configList.find((c) => c.trigger_type === type)) {
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
