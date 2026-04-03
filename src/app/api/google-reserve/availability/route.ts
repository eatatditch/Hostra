import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getAvailableSlots } from "@/server/services/availability";
import { format, addDays } from "date-fns";

// Availability feed for Reserve with Google
// Returns available slots for the next 30 days across all locations

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const merchantId = url.searchParams.get("merchant_id");
  const days = parseInt(url.searchParams.get("days") || "14");

  let locations: any[] = [];

  if (merchantId) {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .eq("id", merchantId)
      .eq("active", true);
    locations = data || [];
  } else {
    const { data } = await supabase
      .from("locations")
      .select("id")
      .eq("active", true);
    locations = data || [];
  }

  const allSlots: any[] = [];
  const today = new Date();

  for (const loc of locations) {
    for (let d = 0; d < Math.min(days, 30); d++) {
      const date = format(addDays(today, d), "yyyy-MM-dd");

      try {
        const slots = await getAvailableSlots({
          locationId: loc.id,
          date,
          partySize: 2, // Default check for 2
        });

        for (const slot of slots) {
          if (slot.available) {
            allSlots.push({
              merchant_id: loc.id,
              service_id: `${loc.id}_dining`,
              start_time: `${date}T${slot.time}:00`,
              duration_sec: 5400, // 90 min default dining time
              spots_total: slot.remainingCovers,
              spots_open: slot.remainingCovers,
              availability_tag: `${loc.id}_${date}_${slot.time}`,
              resources: {
                party_size: [1, 2, 3, 4, 5, 6, 7, 8].filter(
                  (n) => n <= slot.remainingCovers
                ),
              },
            });
          }
        }
      } catch {
        // Skip dates with errors
      }
    }
  }

  return NextResponse.json({
    availability: allSlots,
    generated_at: new Date().toISOString(),
  });
}
