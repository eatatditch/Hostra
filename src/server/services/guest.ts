import { supabase } from "@/lib/db";

export async function searchGuests(query: string, locationId: string) {
  const pattern = `%${query}%`;

  const { data: guestRows, error } = await supabase
    .from("guests")
    .select("*, tags:guest_tags(*), metrics:guest_metrics(*)")
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .limit(25);

  if (error) throw new Error(error.message);

  // Filter metrics to only the requested location (client-side)
  return (guestRows || []).map((g) => ({
    ...g,
    metrics: (g.metrics || []).filter((m: { location_id: string }) => m.location_id === locationId),
  }));
}

export async function getGuestProfile(guestId: string, locationId: string) {
  const { data: guest, error } = await supabase
    .from("guests")
    .select("*, tags:guest_tags(*), notes:guest_notes(*), metrics:guest_metrics(*)")
    .eq("id", guestId)
    .single();

  if (error || !guest) return null;

  // Filter metrics to location, sort notes descending, limit 50
  guest.metrics = (guest.metrics || []).filter(
    (m: { location_id: string }) => m.location_id === locationId
  );
  guest.notes = (guest.notes || [])
    .sort((a: { created_at: string }, b: { created_at: string }) =>
      b.created_at.localeCompare(a.created_at)
    )
    .slice(0, 50);

  // Get visit history for this location
  const { data: visitHistory } = await supabase
    .from("visits")
    .select("*, table:tables(*)")
    .eq("guest_id", guestId)
    .eq("location_id", locationId)
    .order("seated_at", { ascending: false })
    .limit(50);

  // Get communication history
  const { data: commHistory } = await supabase
    .from("communications")
    .select("*")
    .eq("guest_id", guestId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get trigger history
  const { data: triggerHistory } = await supabase
    .from("trigger_events")
    .select("*")
    .eq("guest_id", guestId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    ...guest,
    visits: visitHistory || [],
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

  // If the upsert returned nothing due to ignoreDuplicates, that's ok
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
  // Move all references from duplicate to primary
  await supabase
    .from("reservations")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  await supabase
    .from("waitlist_entries")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  await supabase
    .from("visits")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  await supabase
    .from("communications")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  await supabase
    .from("trigger_events")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  // Move notes (skip tag conflicts)
  await supabase
    .from("guest_notes")
    .update({ guest_id: primaryId })
    .eq("guest_id", duplicateId);

  // Delete duplicate's tags (primary keeps theirs)
  await supabase
    .from("guest_tags")
    .delete()
    .eq("guest_id", duplicateId);

  // Delete duplicate's metrics
  await supabase
    .from("guest_metrics")
    .delete()
    .eq("guest_id", duplicateId);

  // Delete duplicate guest
  await supabase
    .from("guests")
    .delete()
    .eq("id", duplicateId);

  return { merged: true, primaryId };
}
