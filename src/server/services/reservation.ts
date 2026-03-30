import { supabase } from "@/lib/db";
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
        email: input.email || null,
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    guest = newGuest;
  }

  // Check for duplicate: same guest, same date, same location, active status
  const { data: existingReservation } = await supabase
    .from("reservations")
    .select("*")
    .eq("guest_id", guest.id)
    .eq("location_id", input.locationId)
    .eq("date", input.date)
    .not("status", "in", "(cancelled,no_show,completed)")
    .limit(1)
    .single();

  if (existingReservation) {
    throw new Error("DUPLICATE_RESERVATION");
  }

  const token = generateToken();

  const { data: reservation, error: resError } = await supabase
    .from("reservations")
    .insert({
      location_id: input.locationId,
      guest_id: guest.id,
      date: input.date,
      time: input.time,
      party_size: input.partySize,
      source: input.source,
      special_requests: input.specialRequests || null,
      confirmation_token: token,
    })
    .select()
    .single();

  if (resError) throw new Error(resError.message);

  return { reservation, guest, token };
}

export async function cancelReservation(
  reservationId: string,
  token?: string
) {
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (error || !reservation) throw new Error("NOT_FOUND");

  // If cancelling via guest link, verify token
  if (token && reservation.confirmation_token !== token) {
    throw new Error("INVALID_TOKEN");
  }

  if (reservation.status === "cancelled") {
    throw new Error("ALREADY_CANCELLED");
  }

  if (reservation.status === "seated" || reservation.status === "completed") {
    throw new Error("CANNOT_CANCEL");
  }

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function updateReservation(input: UpdateReservationInput) {
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", input.reservationId)
    .single();

  if (error || !reservation) throw new Error("NOT_FOUND");
  if (reservation.status === "cancelled" || reservation.status === "completed") {
    throw new Error("CANNOT_MODIFY");
  }

  // If changing date/time/party size, verify new slot availability
  const newDate = input.date || reservation.date;
  const newTime = input.time || reservation.time;
  const newPartySize = input.partySize || reservation.party_size;

  if (input.date || input.time || input.partySize) {
    const slots = await getAvailableSlots({
      locationId: reservation.location_id,
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

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.date) updateData.date = input.date;
  if (input.time) updateData.time = input.time;
  if (input.partySize) updateData.party_size = input.partySize;
  if (input.specialRequests !== undefined) {
    updateData.special_requests = input.specialRequests || null;
  }
  if (input.tableId !== undefined) updateData.table_id = input.tableId;

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update(updateData)
    .eq("id", input.reservationId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function seatReservation(
  reservationId: string,
  tableId: string
) {
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (error || !reservation) throw new Error("NOT_FOUND");
  if (reservation.status === "seated") throw new Error("ALREADY_SEATED");
  if (reservation.status === "cancelled" || reservation.status === "no_show") {
    throw new Error("CANNOT_SEAT");
  }

  const now = new Date().toISOString();

  // Update reservation
  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "seated",
      table_id: tableId,
      seated_at: now,
      updated_at: now,
    })
    .eq("id", reservationId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // Mark table as occupied
  await supabase
    .from("tables")
    .update({ status: "occupied" })
    .eq("id", tableId);

  // Create visit record
  await supabase.from("visits").insert({
    guest_id: reservation.guest_id,
    location_id: reservation.location_id,
    reservation_id: reservation.id,
    table_id: tableId,
    party_size: reservation.party_size,
    seated_at: now,
  });

  // Update guest metrics
  await updateGuestMetrics(reservation.guest_id, reservation.location_id);

  return updated;
}

export async function completeReservation(reservationId: string) {
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", reservationId)
    .select()
    .single();

  if (updateError || !updated) throw new Error("NOT_FOUND");

  // Mark table as turning
  if (updated.table_id) {
    await supabase
      .from("tables")
      .update({ status: "turning" })
      .eq("id", updated.table_id);
  }

  // Complete the visit
  await supabase
    .from("visits")
    .update({ completed_at: now })
    .eq("reservation_id", reservationId);

  return updated;
}

export async function markNoShow(reservationId: string) {
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "no_show",
      no_show_at: now,
      updated_at: now,
    })
    .eq("id", reservationId)
    .select()
    .single();

  if (updateError || !updated) throw new Error("NOT_FOUND");

  // Increment no-show count in guest metrics
  // First fetch current value
  const { data: metrics } = await supabase
    .from("guest_metrics")
    .select("no_show_count")
    .eq("guest_id", updated.guest_id)
    .eq("location_id", updated.location_id)
    .single();

  if (metrics) {
    await supabase
      .from("guest_metrics")
      .update({
        no_show_count: (metrics.no_show_count || 0) + 1,
        updated_at: now,
      })
      .eq("guest_id", updated.guest_id)
      .eq("location_id", updated.location_id);
  }

  return updated;
}

export async function getReservationsByDate(
  locationId: string,
  date: string
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*, tags:guest_tags(*)), table:tables(*)")
    .eq("location_id", locationId)
    .eq("date", date)
    .order("time", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getReservationByToken(token: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), location:locations(*)")
    .eq("confirmation_token", token)
    .single();

  if (error) return null;
  return data;
}

async function updateGuestMetrics(guestId: string, locationId: string) {
  // Fetch all visits and compute aggregates in JS
  const { data: visitRows } = await supabase
    .from("visits")
    .select("party_size, seated_at")
    .eq("guest_id", guestId)
    .eq("location_id", locationId);

  const rows = visitRows || [];
  const count = rows.length;
  const avgParty = count > 0
    ? rows.reduce((sum, v) => sum + (v.party_size || 0), 0) / count
    : 0;

  const seatedDates = rows
    .map((v) => v.seated_at)
    .filter(Boolean)
    .sort();

  const firstVisit = seatedDates[0] || null;
  const lastVisit = seatedDates[seatedDates.length - 1] || null;

  await supabase
    .from("guest_metrics")
    .upsert(
      {
        guest_id: guestId,
        location_id: locationId,
        total_visits: count,
        avg_party_size: avgParty,
        first_visit_at: firstVisit,
        last_visit_at: lastVisit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guest_id,location_id" }
    );
}
