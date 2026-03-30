import { db } from "@/lib/db";
import { communications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  guestId: string;
  locationId: string;
  templateKey?: string;
  relatedType?: string;
  relatedId?: string;
}

export async function sendEmail(params: SendEmailParams) {
  const [comm] = await db
    .insert(communications)
    .values({
      guestId: params.guestId,
      locationId: params.locationId,
      channel: "email",
      direction: "outbound",
      templateKey: params.templateKey || null,
      content: params.html,
      status: "queued",
      relatedType: params.relatedType || null,
      relatedId: params.relatedId || null,
    })
    .returning();

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.warn("Resend not configured, skipping email send");
      await db
        .update(communications)
        .set({ status: "failed" })
        .where(eq(communications.id, comm.id));
      return comm;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      await db
        .update(communications)
        .set({
          status: "sent",
          externalId: result.id,
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
