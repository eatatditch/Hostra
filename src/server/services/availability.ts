import { supabase } from "@/lib/db";
import { parse, format, addMinutes, isAfter } from "date-fns";
import type { TimeSlot } from "@/types";

interface AvailabilityParams {
  locationId: string;
  date: string; // YYYY-MM-DD
  partySize: number;
}

export async function getAvailableSlots({
  locationId,
  date,
  partySize,
}: AvailabilityParams): Promise<TimeSlot[]> {
  const dateObj = parse(date, "yyyy-MM-dd", new Date());
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

  // Check if date is blocked
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("id")
    .eq("location_id", locationId)
    .eq("date", date)
    .limit(1);

  if (blocked && blocked.length > 0) return [];

  // Load location-level pacing cap (covers per slot)
  const { data: location } = await supabase
    .from("locations")
    .select("pacing_cap_per_slot")
    .eq("id", locationId)
    .single();
  const pacingCap: number | null = location?.pacing_cap_per_slot ?? null;

  // Get active shifts for this day
  const { data: shifts, error: shiftsError } = await supabase
    .from("service_shifts")
    .select("*")
    .eq("location_id", locationId)
    .eq("day_of_week", dayOfWeek)
    .eq("active", true);

  if (shiftsError) throw new Error(shiftsError.message);
  if (!shifts || shifts.length === 0) return [];

  // Get existing reservations for this date (non-cancelled)
  const { data: existingReservations, error: resError } = await supabase
    .from("reservations")
    .select("time, party_size")
    .eq("location_id", locationId)
    .eq("date", date)
    .not("status", "in", "(cancelled,no_show)");

  if (resError) throw new Error(resError.message);

  // Build a map of covers already booked per time slot
  const bookedCoversMap = new Map<string, number>();
  for (const res of existingReservations || []) {
    const timeKey = res.time.slice(0, 5); // HH:mm
    bookedCoversMap.set(timeKey, (bookedCoversMap.get(timeKey) || 0) + res.party_size);
  }

  // Generate time slots across all shifts
  const slots: TimeSlot[] = [];

  for (const shift of shifts) {
    const slotDuration = shift.slot_duration_min;
    const shiftStart = parse(shift.start_time, "HH:mm:ss", dateObj);
    const shiftEnd = parse(shift.end_time, "HH:mm:ss", dateObj);
    const lastSlotStart = addMinutes(shiftEnd, -slotDuration);

    let current = shiftStart;
    while (!isAfter(current, lastSlotStart)) {
      const timeStr = format(current, "HH:mm");

      const bookedCovers = bookedCoversMap.get(timeStr) || 0;
      const remainingCovers = shift.max_covers - bookedCovers;

      // Per-slot pacing cap: when set, slot is full once booked covers ≥ cap
      const slotCapped = pacingCap != null && bookedCovers >= pacingCap;
      const slotRemaining = pacingCap != null
        ? Math.max(0, Math.min(remainingCovers, pacingCap - bookedCovers))
        : remainingCovers;
      const available = !slotCapped && slotRemaining >= partySize;

      slots.push({ time: timeStr, available, remainingCovers: slotRemaining });

      current = addMinutes(current, slotDuration);
    }
  }

  return slots;
}
