import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communications, guests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = (formData.get("Body") as string)?.trim();

  if (!from || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Handle STOP/opt-out
  if (body.toUpperCase() === "STOP") {
    await db
      .update(guests)
      .set({ smsOptOut: true, updatedAt: new Date() })
      .where(eq(guests.phone, from));

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Handle START/opt-in
  if (body.toUpperCase() === "START") {
    await db
      .update(guests)
      .set({ smsOptOut: false, updatedAt: new Date() })
      .where(eq(guests.phone, from));

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Log inbound message
  const guest = await db.query.guests.findFirst({
    where: eq(guests.phone, from),
  });

  if (guest) {
    // Get the most recent location from their communications
    const lastComm = await db.query.communications.findFirst({
      where: eq(communications.guestId, guest.id),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });

    if (lastComm) {
      await db.insert(communications).values({
        guestId: guest.id,
        locationId: lastComm.locationId,
        channel: "sms",
        direction: "inbound",
        content: body,
        status: "delivered",
        sentAt: new Date(),
      });
    }
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
