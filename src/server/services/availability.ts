import { db } from "@/lib/db";
import { serviceShifts, reservations } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { parse, format, addMinutes, isBefore, isAfter } from "date-fns";
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

  // Get active shifts for this day
  const shifts = await db
    .select()
    .from(serviceShifts)
    .where(
      and(
        eq(serviceShifts.locationId, locationId),
        eq(serviceShifts.dayOfWeek, dayOfWeek),
        eq(serviceShifts.active, true)
      )
    );

  if (shifts.length === 0) return [];

  // Get existing reservations for this date (non-cancelled)
  const existingReservations = await db
    .select({
      time: reservations.time,
      partySize: reservations.partySize,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.locationId, locationId),
        eq(reservations.date, date),
        sql`${reservations.status} NOT IN ('cancelled', 'no_show')`
      )
    );

  // Build a map of covers already booked per time slot
  const bookedCoversMap = new Map<string, number>();
  for (const res of existingReservations) {
    const timeKey = res.time.slice(0, 5); // HH:mm
    bookedCoversMap.set(timeKey, (bookedCoversMap.get(timeKey) || 0) + res.partySize);
  }

  // Generate time slots across all shifts
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (const shift of shifts) {
    const slotDuration = shift.slotDurationMin;
    const shiftStart = parse(shift.startTime, "HH:mm:ss", dateObj);
    const shiftEnd = parse(shift.endTime, "HH:mm:ss", dateObj);
    // Allow booking up to 1 slot before end of shift
    const lastSlotStart = addMinutes(shiftEnd, -slotDuration);

    let current = shiftStart;
    while (!isAfter(current, lastSlotStart)) {
      const timeStr = format(current, "HH:mm");

      // Don't show past time slots for today
      const slotDateTime = parse(
        `${date} ${timeStr}`,
        "yyyy-MM-dd HH:mm",
        new Date()
      );
      if (!isBefore(now, slotDateTime) && format(now, "yyyy-MM-dd") === date) {
        current = addMinutes(current, slotDuration);
        continue;
      }

      const bookedCovers = bookedCoversMap.get(timeStr) || 0;
      const remainingCovers = shift.maxCovers - bookedCovers;
      const available = remainingCovers >= partySize;

      slots.push({ time: timeStr, available, remainingCovers });

      current = addMinutes(current, slotDuration);
    }
  }

  return slots;
}
