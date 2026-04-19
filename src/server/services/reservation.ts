import { supabase } from "@/lib/db";
import { generateToken, normalizePhone } from "@/lib/utils";
import { getAvailableSlots } from "./availability";
import { dispatchNotification } from "@/lib/communications/dispatcher";
import {
  createPaymentIntent,
  captureDepositForNoShow,
  refundDepositForCancellation,
} from "./payment";
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

  // Check per-location deposit + booking caps
  const { data: location } = await supabase
    .from("locations")
    .select(
      "deposit_amount_cents, deposit_min_party_size, max_booking_party_size"
    )
    .eq("id", input.locationId)
    .single();

  // Enforce public-booking party-size cap. Staff and phone bookings are
  // not restricted — hosts can always book any party size internally.
  if (input.source === "web") {
    const maxBookingParty = (location as any)?.max_booking_party_size;
    if (
      typeof maxBookingParty === "number" &&
      maxBookingParty > 0 &&
      input.partySize > maxBookingParty
    ) {
      throw new Error("PARTY_TOO_LARGE");
    }
  }

  const depositAmount = location?.deposit_amount_cents || 0;
  const depositMinParty = location?.deposit_min_party_size || 0;
  // Deposits only apply to public-web bookings. Staff, phone, and walk-in
  // bookings bypass Stripe entirely — staff collect payment in-person when
  // needed, and these flows must not fail when Stripe isn't configured.
  const depositRequired =
    input.source === "web" &&
    depositAmount > 0 &&
    depositMinParty > 0 &&
    input.partySize >= depositMinParty;

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
      status: depositRequired ? "pending_deposit" : "confirmed",
    })
    .select()
    .single();

  if (resError) throw new Error(resError.message);

  let deposit: {
    clientSecret: string | null;
    paymentIntentId: string;
    amountCents: number;
  } | null = null;

  if (depositRequired) {
    try {
      const result = await createPaymentIntent({
        guestId: guest.id,
        reservationId: reservation.id,
        amountCents: depositAmount,
        currency: "usd",
        type: "deposit",
        captureMethod: "manual",
      });
      deposit = {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amountCents: depositAmount,
      };
    } catch (err) {
      // Roll the reservation back if we couldn't create the intent
      await supabase.from("reservations").delete().eq("id", reservation.id);
      throw err;
    }
  } else {
    // Only send confirmation immediately when no deposit is required.
    // Deposit reservations are confirmed via the Stripe webhook once the
    // PaymentIntent is authorized (requires_capture).
    dispatchNotification("reservation_confirmation", {
      guestId: guest.id,
      locationId: input.locationId,
      reservationId: reservation.id,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      confirmationToken: token,
    }, ["sms", "email"]).catch(() => {});
  }

  return { reservation, guest, token, deposit };
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

  // Compute refund percent from the location's cancellation policy. If the
  // cancellation happens before the window, the guest gets a full refund;
  // inside the window, the configured partial refund percent applies.
  const { data: location } = await supabase
    .from("locations")
    .select("cancellation_window_hours, cancellation_refund_percent, timezone")
    .eq("id", reservation.location_id)
    .single();

  const windowHours = (location as any)?.cancellation_window_hours;
  const refundPercentSetting = (location as any)?.cancellation_refund_percent;

  let refundPercent = 100;
  if (typeof windowHours === "number" && windowHours > 0) {
    const tz = (location as any)?.timezone || "America/New_York";
    const reservationAtMs = wallClockToUtcMs(
      reservation.date,
      reservation.time,
      tz
    );
    const hoursUntil = (reservationAtMs - Date.now()) / (60 * 60 * 1000);
    if (hoursUntil < windowHours) {
      refundPercent =
        typeof refundPercentSetting === "number" &&
        refundPercentSetting >= 0 &&
        refundPercentSetting <= 100
          ? refundPercentSetting
          : 0;
    }
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

  // Apply the deposit refund if one exists. Best-effort — Stripe failures
  // must not block the cancellation from persisting.
  await refundDepositForCancellation(reservationId, refundPercent).catch(
    (err) => {
      console.error("cancelReservation: refund failed", reservationId, err);
    }
  );

  // Send cancellation notification
  dispatchNotification("reservation_cancelled", {
    guestId: reservation.guest_id,
    locationId: reservation.location_id,
    reservationId: reservation.id,
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.party_size,
  }, ["sms", "email"]).catch(() => {});

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

  // Normalize HH:MM so "18:00" from input compares equal to "18:00:00" from Postgres
  const newTimeHM = newTime.slice(0, 5);
  const currentTimeHM = (reservation.time || "").slice(0, 5);
  const dateChanged = !!input.date && input.date !== reservation.date;
  const timeChanged = !!input.time && newTimeHM !== currentTimeHM;
  const partySizeChanged =
    !!input.partySize && input.partySize !== reservation.party_size;

  if (dateChanged || timeChanged || partySizeChanged) {
    const slots = await getAvailableSlots({
      locationId: reservation.location_id,
      date: newDate,
      partySize: newPartySize,
    });
    const targetSlot = slots.find((s) => s.time === newTimeHM);
    // Allow keeping the current slot even if it now shows unavailable (this reservation occupies it)
    const sameSlot = !dateChanged && !timeChanged;
    if (targetSlot && !targetSlot.available && !sameSlot) {
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

  // Capture any authorized deposit as a no-show fee. Best-effort — failures
  // here don't block the reservation transition.
  await captureDepositForNoShow(reservationId).catch((err) => {
    console.error("markNoShow: capture failed", reservationId, err);
  });

  return updated;
}

export async function undoNoShow(reservationId: string) {
  const now = new Date().toISOString();

  const { data: reservation, error: fetchError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (fetchError || !reservation) throw new Error("NOT_FOUND");
  if (reservation.status !== "no_show") throw new Error("NOT_NO_SHOW");

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "confirmed",
      no_show_at: null,
      updated_at: now,
    })
    .eq("id", reservationId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // Decrement no-show count in guest metrics
  const { data: metrics } = await supabase
    .from("guest_metrics")
    .select("no_show_count")
    .eq("guest_id", reservation.guest_id)
    .eq("location_id", reservation.location_id)
    .single();

  if (metrics && metrics.no_show_count > 0) {
    await supabase
      .from("guest_metrics")
      .update({
        no_show_count: metrics.no_show_count - 1,
        updated_at: now,
      })
      .eq("guest_id", reservation.guest_id)
      .eq("location_id", reservation.location_id);
  }

  return updated;
}

export async function getReservationsByDate(
  locationId: string,
  date: string
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*, tags:guest_tags(*)), table:tables(*), payments(id, amount_cents, currency, status, type)")
    .eq("location_id", locationId)
    .eq("date", date)
    .order("time", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getReservationByToken(token: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "*, guest:guests(*), location:locations(*), payments(id, amount_cents, currency, status, type, created_at)"
    )
    .eq("confirmation_token", token)
    .single();

  if (error) return null;
  return data;
}

// Given a wall-clock date/time in a named IANA timezone, return the UTC ms
// epoch for that moment. Uses Intl to resolve the tz's offset on that date,
// which correctly handles DST transitions.
function wallClockToUtcMs(
  dateStr: string,
  timeStr: string | null | undefined,
  tz: string
): number {
  const t = (timeStr || "00:00:00").slice(0, 8);
  const naiveUtcMs = Date.parse(`${dateStr}T${t}Z`);
  if (Number.isNaN(naiveUtcMs)) return Date.now();

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(naiveUtcMs));
  const find = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const tzUtcMs = Date.UTC(
    find("year"),
    find("month") - 1,
    find("day"),
    find("hour"),
    find("minute"),
    find("second")
  );
  const offsetMs = tzUtcMs - naiveUtcMs;
  return naiveUtcMs - offsetMs;
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
