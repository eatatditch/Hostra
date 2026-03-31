import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = (formData.get("Body") as string)?.trim();

  if (!from || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Handle STOP/opt-out
  if (body.toUpperCase() === "STOP") {
    await supabase
      .from("guests")
      .update({ sms_opt_out: true, updated_at: new Date().toISOString() })
      .eq("phone", from);

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Handle START/opt-in
  if (body.toUpperCase() === "START") {
    await supabase
      .from("guests")
      .update({ sms_opt_out: false, updated_at: new Date().toISOString() })
      .eq("phone", from);

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Log inbound message
  const { data: guest } = await supabase
    .from("guests")
    .select("id")
    .eq("phone", from)
    .single();

  if (guest) {
    // Get the most recent location from their communications
    const { data: lastComm } = await supabase
      .from("communications")
      .select("location_id")
      .eq("guest_id", guest.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastComm) {
      await supabase.from("communications").insert({
        guest_id: guest.id,
        location_id: lastComm.location_id,
        channel: "sms",
        direction: "inbound",
        content: body,
        status: "delivered",
        sent_at: new Date().toISOString(),
      });
    }
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
