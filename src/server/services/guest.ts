import { supabase } from "@/lib/db";

export async function searchGuests(query: string) {
  const pattern = `%${query}%`;

  const { data: guestRows, error } = await supabase
    .from("guests")
    .select("*, tags:guest_tags(*), metrics:guest_metrics(*, location:locations(id, name))")
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .limit(25);

  if (error) throw new Error(error.message);

  // Compute total visits across all locations
  return (guestRows || []).map((g) => {
    const allMetrics = g.metrics || [];
    const totalVisitsAllLocations = allMetrics.reduce(
      (sum: number, m: any) => sum + (m.total_visits || 0),
      0
    );
    return {
      ...g,
      totalVisitsAllLocations,
    };
  });
}

export async function getGuestProfile(guestId: string) {
  const { data: guest, error } = await supabase
    .from("guests")
    .select("*, tags:guest_tags(*), notes:guest_notes(*), metrics:guest_metrics(*, location:locations(id, name))")
    .eq("id", guestId)
    .single();

  if (error || !guest) return null;

  // Sort notes descending, limit 50
  guest.notes = (guest.notes || [])
    .sort((a: { created_at: string }, b: { created_at: string }) =>
      b.created_at.localeCompare(a.created_at)
    )
    .slice(0, 50);

  // Get visit history across ALL locations, with location name
  const { data: visitHistory } = await supabase
    .from("visits")
    .select("*, table:tables(*), location:locations(id, name)")
    .eq("guest_id", guestId)
    .order("seated_at", { ascending: false })
    .limit(50);

  // Get reservation history across ALL locations for "locations visited"
  const { data: reservationHistory } = await supabase
    .from("reservations")
    .select("id, location_id, date, time, party_size, status, location:locations(id, name)")
    .eq("guest_id", guestId)
    .order("date", { ascending: false })
    .limit(50);

  // Get communication history across all locations
  const { data: commHistory } = await supabase
    .from("communications")
    .select("*, location:locations(id, name)")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get trigger history across all locations
  const { data: triggerHistory } = await supabase
    .from("trigger_events")
    .select("*, location:locations(id, name)")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Build "locations visited" summary from completed visits (not no-shows)
  const locationsVisited = new Map<string, { id: string; name: string; visitCount: number; lastVisit: string }>();
  for (const visit of visitHistory || []) {
    if (!visit.location) continue;
    const existing = locationsVisited.get(visit.location.id);
    if (existing) {
      existing.visitCount++;
      if (visit.seated_at > existing.lastVisit) existing.lastVisit = visit.seated_at;
    } else {
      locationsVisited.set(visit.location.id, {
        id: visit.location.id,
        name: visit.location.name,
        visitCount: 1,
        lastVisit: visit.seated_at,
      });
    }
  }

  // Aggregate metrics across all locations
  const allMetrics = guest.metrics || [];
  const aggregatedMetrics = {
    totalVisits: allMetrics.reduce((s: number, m: any) => s + (m.total_visits || 0), 0),
    totalNoShows: allMetrics.reduce((s: number, m: any) => s + (m.no_show_count || 0), 0),
    avgPartySize: allMetrics.length > 0
      ? allMetrics.reduce((s: number, m: any) => s + (m.avg_party_size || 0), 0) / allMetrics.length
      : 0,
    lastVisitAt: allMetrics
      .map((m: any) => m.last_visit_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null,
  };

  return {
    ...guest,
    aggregatedMetrics,
    locationsVisited: Array.from(locationsVisited.values()),
    visits: visitHistory || [],
    reservations: reservationHistory || [],
    communications: commHistory || [],
    triggers: triggerHistory || [],
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
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.firstName) updateData.first_name = data.firstName;
  if (data.lastName !== undefined) updateData.last_name = data.lastName || null;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.dateOfBirth !== undefined) updateData.date_of_birth = data.dateOfBirth;
  if (data.anniversaryDate !== undefined) updateData.anniversary_date = data.anniversaryDate;
  if (data.dietaryRestrictions !== undefined) updateData.dietary_restrictions = data.dietaryRestrictions;
  if (data.allergies !== undefined) updateData.allergies = data.allergies;

  const { data: updated, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", guestId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

export async function addNote(
  guestId: string,
  staffId: string,
  content: string,
  flagged = false
) {
  const { data: note, error } = await supabase
    .from("guest_notes")
    .insert({ guest_id: guestId, staff_id: staffId, content, flagged })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return note;
}

export async function addTag(guestId: string, tag: string, staffId: string) {
  const { data: result, error } = await supabase
    .from("guest_tags")
    .upsert(
      { guest_id: guestId, tag, created_by: staffId },
      { onConflict: "guest_id,tag", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error && !error.message.includes("No rows")) throw new Error(error.message);
  return result;
}

export async function removeTag(guestId: string, tag: string) {
  await supabase
    .from("guest_tags")
    .delete()
    .eq("guest_id", guestId)
    .eq("tag", tag);
}

export async function mergeGuests(
  primaryId: string,
  duplicateId: string
) {
  await supabase.from("reservations").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("waitlist_entries").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("visits").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("communications").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("trigger_events").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("guest_notes").update({ guest_id: primaryId }).eq("guest_id", duplicateId);
  await supabase.from("guest_tags").delete().eq("guest_id", duplicateId);
  await supabase.from("guest_metrics").delete().eq("guest_id", duplicateId);
  await supabase.from("guests").delete().eq("id", duplicateId);

  return { merged: true, primaryId };
}
