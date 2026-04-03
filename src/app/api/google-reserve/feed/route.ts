import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// Merchant/Service feed for Reserve with Google
// Google periodically fetches this to know which merchants are available

export async function GET() {
  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("active", true);

  if (!locations || locations.length === 0) {
    return NextResponse.json({ merchants: [] });
  }

  // Get shifts for all locations
  const { data: allShifts } = await supabase
    .from("service_shifts")
    .select("*")
    .eq("active", true);

  const merchants = locations.map((loc) => {
    const locShifts = (allShifts || []).filter(
      (s: any) => s.location_id === loc.id
    );

    // Build operating hours from shifts
    const operatingHours = buildOperatingHours(locShifts);

    return {
      merchant_id: loc.id,
      name: loc.name,
      telephone: loc.phone || "",
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://reservations.eatatditch.com"}/reserve`,
      geo: {
        address: {
          street_address: loc.address || "",
          locality: "",
          region: "",
          postal_code: "",
          country: "US",
        },
      },
      category: "restaurant",
      operating_hours: operatingHours,
      service: [
        {
          service_id: `${loc.id}_dining`,
          name: "Table Reservation",
          description: `Reserve a table at ${loc.name}`,
          price: {
            currency_code: "USD",
            price_micros: "0",
          },
          rules: {
            min_advance_booking_sec: 3600, // 1 hour minimum
            max_advance_booking_sec: 2592000, // 30 days max
            min_party_size: 1,
            max_party_size: 8,
          },
          prepayment_type: "NOT_REQUIRED",
          require_credit_card: "DO_NOT_REQUIRE",
        },
      ],
      action_link: [
        {
          url: `${process.env.NEXT_PUBLIC_APP_URL || "https://reservations.eatatditch.com"}/reserve`,
          language: "en",
          label: "Book a Table",
        },
      ],
    };
  });

  return NextResponse.json({
    merchants,
    generated_at: new Date().toISOString(),
  });
}

function buildOperatingHours(shifts: any[]): any {
  const dayNames = [
    "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
    "THURSDAY", "FRIDAY", "SATURDAY",
  ];

  const periods: any[] = [];

  for (const shift of shifts) {
    periods.push({
      day_of_week: dayNames[shift.day_of_week],
      open_time: shift.start_time.slice(0, 5),
      close_time: shift.end_time.slice(0, 5),
    });
  }

  return { periods };
}
