import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getAvailableSlots } from "@/server/services/availability";
import { createReservation, cancelReservation } from "@/server/services/reservation";

// Reserve with Google Booking Server API v3
// Spec: https://developers.google.com/actions-center/verticals/reservations/e2e/reference/booking-server-api-rest

const API_KEY = process.env.GOOGLE_RESERVE_API_KEY || "";

function verifyApiKey(request: NextRequest): boolean {
  if (!API_KEY) return true; // Skip auth if not configured
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${API_KEY}`;
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: { code: status, message } }, { status });
}

export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return errorResponse(401, "Unauthorized");
  }

  const url = new URL(request.url);
  const path = url.pathname.replace("/api/google-reserve", "");
  const body = await request.json().catch(() => ({}));

  switch (path) {
    case "/v3/HealthCheck":
      return handleHealthCheck();
    case "/v3/CheckAvailability":
      return handleCheckAvailability(body);
    case "/v3/BatchAvailabilityLookup":
      return handleBatchAvailabilityLookup(body);
    case "/v3/CreateBooking":
      return handleCreateBooking(body);
    case "/v3/UpdateBooking":
      return handleUpdateBooking(body);
    case "/v3/GetBookingStatus":
      return handleGetBookingStatus(body);
    case "/v3/ListBookings":
      return handleListBookings(body);
    default:
      return errorResponse(404, `Unknown endpoint: ${path}`);
  }
}

// Also handle GET for health check
export async function GET() {
  return handleHealthCheck();
}

// ── HealthCheck ──────────────────────────────────────────

async function handleHealthCheck() {
  return NextResponse.json({ status: "SERVING" });
}

// ── CheckAvailability ────────────────────────────────────

async function handleCheckAvailability(body: any) {
  const { slot } = body;
  if (!slot) return errorResponse(400, "Missing slot");

  const { merchant_id, start_time, party_size } = slot;
  if (!merchant_id || !start_time || !party_size) {
    return errorResponse(400, "Missing required slot fields");
  }

  // merchant_id maps to our location_id
  const date = start_time.slice(0, 10); // YYYY-MM-DD
  const time = start_time.slice(11, 16); // HH:mm

  try {
    const slots = await getAvailableSlots({
      locationId: merchant_id,
      date,
      partySize: party_size,
    });

    const matchingSlot = slots.find((s) => s.time === time);
    const available = matchingSlot?.available || false;

    return NextResponse.json({
      slot: {
        merchant_id,
        start_time,
        party_size,
        availability: available ? "AVAILABLE" : "UNAVAILABLE",
        ...(available && {
          spots_open: matchingSlot?.remainingCovers || 0,
        }),
      },
    });
  } catch (e: any) {
    return errorResponse(500, e.message);
  }
}

// ── BatchAvailabilityLookup ──────────────────────────────

async function handleBatchAvailabilityLookup(body: any) {
  const { merchant_id, slot_time_range, party_size } = body;
  if (!merchant_id || !slot_time_range) {
    return errorResponse(400, "Missing required fields");
  }

  const startDate = slot_time_range.start_time?.slice(0, 10);
  const endDate = slot_time_range.end_time?.slice(0, 10);
  if (!startDate) return errorResponse(400, "Missing start_time");

  try {
    // Get availability for up to 30 days
    const allSlots: any[] = [];
    const start = new Date(startDate + "T00:00:00");
    const end = endDate ? new Date(endDate + "T00:00:00") : new Date(start);
    end.setDate(end.getDate() + 30); // Cap at 30 days

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const slots = await getAvailableSlots({
        locationId: merchant_id,
        date: dateStr,
        partySize: party_size || 2,
      });

      for (const slot of slots) {
        if (slot.available) {
          allSlots.push({
            merchant_id,
            start_time: `${dateStr}T${slot.time}:00`,
            party_size: party_size || 2,
            availability: "AVAILABLE",
            spots_open: slot.remainingCovers,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ slots: allSlots });
  } catch (e: any) {
    return errorResponse(500, e.message);
  }
}

// ── CreateBooking ────────────────────────────────────────

async function handleCreateBooking(body: any) {
  const { slot, user_information, idempotency_token } = body;
  if (!slot || !user_information) {
    return errorResponse(400, "Missing required fields");
  }

  // Check for existing booking with same idempotency token
  if (idempotency_token) {
    const { data: existing } = await supabase
      .from("reservations")
      .select("*, guest:guests(*)")
      .eq("confirmation_token", `goog_${idempotency_token}`)
      .single();

    if (existing) {
      return NextResponse.json({
        booking: formatBookingResponse(existing),
      });
    }
  }

  const { merchant_id, start_time, party_size } = slot;
  const { given_name, family_name, telephone, email } = user_information;

  const date = start_time.slice(0, 10);
  const time = start_time.slice(11, 16);

  try {
    const result = await createReservation({
      locationId: merchant_id,
      firstName: given_name || "Guest",
      lastName: family_name,
      phone: telephone || "+10000000000",
      email: email,
      date,
      time,
      partySize: party_size,
      source: "web",
    });

    // Update the confirmation token to include google prefix for idempotency
    if (idempotency_token) {
      await supabase
        .from("reservations")
        .update({ confirmation_token: `goog_${idempotency_token}` })
        .eq("id", result.reservation.id);
    }

    return NextResponse.json({
      booking: {
        booking_id: result.reservation.id,
        slot: {
          merchant_id,
          start_time,
          party_size,
          confirmation_id: result.reservation.id,
        },
        user_information: {
          given_name,
          family_name,
          telephone,
          email,
        },
        status: "CONFIRMED",
        payment_information: {
          prepayment_status: "PREPAYMENT_NOT_PROVIDED",
        },
      },
    });
  } catch (e: any) {
    if (e.message === "SLOT_UNAVAILABLE") {
      return NextResponse.json({
        booking_failure: {
          cause: "SLOT_UNAVAILABLE",
          description: "The requested time slot is no longer available",
        },
      });
    }
    if (e.message === "DUPLICATE_RESERVATION") {
      return NextResponse.json({
        booking_failure: {
          cause: "BOOKING_ALREADY_EXISTS",
          description: "Guest already has a reservation for this date",
        },
      });
    }
    return errorResponse(500, e.message);
  }
}

// ── UpdateBooking ────────────────────────────────────────

async function handleUpdateBooking(body: any) {
  const { booking } = body;
  if (!booking?.booking_id) {
    return errorResponse(400, "Missing booking_id");
  }

  try {
    // Handle cancellation
    if (booking.status === "CANCELLED" || booking.status === "CANCELED") {
      const updated = await cancelReservation(booking.booking_id);
      return NextResponse.json({
        booking: {
          booking_id: booking.booking_id,
          status: "CANCELLED",
          slot: {
            merchant_id: updated.location_id,
            start_time: `${updated.date}T${updated.time}`,
            party_size: updated.party_size,
          },
        },
      });
    }

    // Handle other updates (party size, time change)
    const updateData: Record<string, unknown> = {};
    if (booking.slot?.party_size) updateData.party_size = booking.slot.party_size;
    if (booking.slot?.start_time) {
      updateData.date = booking.slot.start_time.slice(0, 10);
      updateData.time = booking.slot.start_time.slice(11, 16);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", booking.booking_id)
        .select("*, guest:guests(*)")
        .single();

      if (error) return errorResponse(404, "Booking not found");

      return NextResponse.json({
        booking: formatBookingResponse(updated),
      });
    }

    return errorResponse(400, "No update fields provided");
  } catch (e: any) {
    return errorResponse(500, e.message);
  }
}

// ── GetBookingStatus ─────────────────────────────────────

async function handleGetBookingStatus(body: any) {
  const { booking_id } = body;
  if (!booking_id) return errorResponse(400, "Missing booking_id");

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*, guest:guests(*)")
    .eq("id", booking_id)
    .single();

  if (error || !reservation) {
    return errorResponse(404, "Booking not found");
  }

  return NextResponse.json({
    booking: formatBookingResponse(reservation),
  });
}

// ── ListBookings ─────────────────────────────────────────

async function handleListBookings(body: any) {
  const { user_id } = body;

  // user_id isn't used in our system — we list by guest phone/email
  // For now, return empty since Google manages user mapping
  return NextResponse.json({ bookings: [] });
}

// ── Helpers ──────────────────────────────────────────────

function mapStatus(status: string): string {
  switch (status) {
    case "confirmed":
    case "reminded":
      return "CONFIRMED";
    case "seated":
    case "completed":
      return "FULFILLED";
    case "cancelled":
      return "CANCELLED";
    case "no_show":
      return "NO_SHOW";
    default:
      return "CONFIRMED";
  }
}

function formatBookingResponse(reservation: any) {
  return {
    booking_id: reservation.id,
    slot: {
      merchant_id: reservation.location_id,
      start_time: `${reservation.date}T${reservation.time}`,
      party_size: reservation.party_size,
      confirmation_id: reservation.id,
    },
    user_information: {
      given_name: reservation.guest?.first_name,
      family_name: reservation.guest?.last_name,
      telephone: reservation.guest?.phone,
      email: reservation.guest?.email,
    },
    status: mapStatus(reservation.status),
    payment_information: {
      prepayment_status: "PREPAYMENT_NOT_PROVIDED",
    },
  };
}
