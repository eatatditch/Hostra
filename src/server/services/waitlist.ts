import { supabase } from "@/lib/db";
import { generateToken, normalizePhone } from "@/lib/utils";
import type {
  JoinWaitlistInput,
  UpdateWaitlistInput,
} from "@/lib/validators/waitlist";

const AVG_TURN_TIME_MINUTES = 45;

export async function joinWaitlist(input: JoinWaitlistInput) {
  const phone = normalizePhone(input.phone);

  // Find or create guest
  const { data: existingGuest } = await supabase
    .from("guests")
    .select("*")
    .eq("phone", phone)
    .single();

  let guest = existingGuest;

  if (!guest) {
    const { data: newGuest, error: insertError } = await supabase
      .from("guests")
      .insert({
        phone,
        first_name: input.firstName,
        last_name: input.lastName || null,
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    guest = newGuest;
  }

  // Check if guest is already on the waitlist
  const { data: existing } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("guest_id", guest.id)
    .eq("location_id", input.locationId)
    .eq("status", "waiting")
    .limit(1)
    .single();

  if (existing) {
    throw new Error("ALREADY_ON_WAITLIST");
  }

  // Get current max position
  const { data: waitingEntries } = await supabase
    .from("waitlist_entries")
    .select("position")
    .eq("location_id", input.locationId)
    .eq("status", "waiting")
    .order("position", { ascending: false })
    .limit(1);

  const maxPosition = waitingEntries && waitingEntries.length > 0
    ? waitingEntries[0].position
    : 0;

  const position = maxPosition + 1;
  const estimatedWait = await estimateWaitTime(
    input.locationId,
    input.partySize,
    position
  );

  const token = generateToken();

  const { data: entry, error: entryError } = await supabase
    .from("waitlist_entries")
    .insert({
      location_id: input.locationId,
      guest_id: guest.id,
      party_size: input.partySize,
      position,
      estimated_wait_minutes: estimatedWait,
      source: input.source,
      check_token: token,
    })
    .select()
    .single();

  if (entryError) throw new Error(entryError.message);

  return { entry, guest, token };
}

export async function notifyWaitlistEntry(entryId: string) {
  const { data: entry, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error || !entry) throw new Error("NOT_FOUND");
  if (entry.status !== "waiting") throw new Error("NOT_WAITING");

  const { data: updated, error: updateError } = await supabase
    .from("waitlist_entries")
    .update({
      status: "notified",
      notified_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function seatWaitlistEntry(entryId: string, tableId: string) {
  const { data: entry, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error || !entry) throw new Error("NOT_FOUND");
  if (entry.status !== "waiting" && entry.status !== "notified") {
    throw new Error("CANNOT_SEAT");
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("waitlist_entries")
    .update({
      status: "seated",
      table_id: tableId,
      seated_at: now,
    })
    .eq("id", entryId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // Mark table occupied
  await supabase
    .from("tables")
    .update({ status: "occupied" })
    .eq("id", tableId);

  // Create visit record
  await supabase.from("visits").insert({
    guest_id: entry.guest_id,
    location_id: entry.location_id,
    waitlist_entry_id: entry.id,
    table_id: tableId,
    party_size: entry.party_size,
    seated_at: now,
  });

  // Recalculate positions for remaining entries
  await recalculatePositions(entry.location_id);

  return updated;
}

export async function updateWaitlistEntry(input: UpdateWaitlistInput) {
  const { data: entry, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", input.entryId)
    .single();

  if (error || !entry) throw new Error("NOT_FOUND");
  if (entry.status !== "waiting" && entry.status !== "notified") {
    throw new Error("CANNOT_MODIFY");
  }

  const updateData: Record<string, unknown> = {};
  if (input.partySize !== undefined) updateData.party_size = input.partySize;
  if (input.estimatedWaitMinutes !== undefined) {
    updateData.estimated_wait_minutes = input.estimatedWaitMinutes;
  }

  if (Object.keys(updateData).length === 0) return entry;

  const { data: updated, error: updateError } = await supabase
    .from("waitlist_entries")
    .update(updateData)
    .eq("id", input.entryId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function removeWaitlistEntry(entryId: string) {
  const { data: entry, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error || !entry) throw new Error("NOT_FOUND");
  if (entry.status === "seated") throw new Error("ALREADY_SEATED");

  const { data: updated, error: updateError } = await supabase
    .from("waitlist_entries")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await recalculatePositions(entry.location_id);

  return updated;
}

export async function getActiveWaitlist(locationId: string) {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("*, guest:guests(*, tags:guest_tags(*))")
    .eq("location_id", locationId)
    .in("status", ["waiting", "notified"])
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getWaitlistByToken(token: string) {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("*, guest:guests(*)")
    .eq("check_token", token)
    .single();

  if (error) return null;
  return data;
}

async function recalculatePositions(locationId: string) {
  const { data: active } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true });

  if (!active) return;

  for (let i = 0; i < active.length; i++) {
    const estimatedWait = await estimateWaitTime(
      locationId,
      0, // party size not needed for position-based estimate
      i + 1
    );

    await supabase
      .from("waitlist_entries")
      .update({
        position: i + 1,
        estimated_wait_minutes: estimatedWait,
      })
      .eq("id", active[i].id);
  }
}

async function estimateWaitTime(
  locationId: string,
  _partySize: number,
  position: number
): Promise<number> {
  // Get average turn time from recent visits
  const { data: recentVisits } = await supabase
    .from("visits")
    .select("seated_at, completed_at")
    .eq("location_id", locationId)
    .not("completed_at", "is", null)
    .gte("seated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  let avgTurn = AVG_TURN_TIME_MINUTES;
  if (recentVisits && recentVisits.length > 0) {
    const totalMinutes = recentVisits.reduce((sum, v) => {
      const seated = new Date(v.seated_at).getTime();
      const completed = new Date(v.completed_at).getTime();
      return sum + (completed - seated) / (1000 * 60);
    }, 0);
    avgTurn = Math.round(totalMinutes / recentVisits.length);
  }

  // Get number of currently occupied tables
  const { count: occupiedCount } = await supabase
    .from("tables")
    .select("*", { count: "exact", head: true })
    .eq("location_id", locationId)
    .eq("status", "occupied");

  const occupiedTables = occupiedCount || 1;

  // Estimate: position in queue * avg turn time / number of tables turning
  return Math.max(5, Math.round((position * avgTurn) / Math.max(occupiedTables, 1)));
}
