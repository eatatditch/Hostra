import { db } from "@/lib/db";
import { communications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface SendSmsParams {
  to: string;
  body: string;
  guestId: string;
  locationId: string;
  templateKey?: string;
  relatedType?: string;
  relatedId?: string;
}

export async function sendSms(params: SendSmsParams) {
  // Log the communication first
  const [comm] = await db
    .insert(communications)
    .values({
      guestId: params.guestId,
      locationId: params.locationId,
      channel: "sms",
      direction: "outbound",
      templateKey: params.templateKey || null,
      content: params.body,
      status: "queued",
      relatedType: params.relatedType || null,
      relatedId: params.relatedId || null,
    })
    .returning();

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio not configured, skipping SMS send");
      await db
        .update(communications)
        .set({ status: "failed" })
        .where(eq(communications.id, comm.id));
      return comm;
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: params.to,
          From: fromNumber,
          Body: params.body,
        }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      await db
        .update(communications)
        .set({
          status: "sent",
          externalId: result.sid,
          sentAt: new Date(),
        })
        .where(eq(communications.id, comm.id));
    } else {
      await db
        .update(communications)
        .set({ status: "failed" })
        .where(eq(communications.id, comm.id));
    }

    return comm;
  } catch (error) {
    await db
      .update(communications)
      .set({ status: "failed" })
      .where(eq(communications.id, comm.id));
    throw error;
  }
}
