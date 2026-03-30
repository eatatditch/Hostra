import { serve } from "inngest/next";
import { Inngest } from "inngest";
import { dispatchNotification } from "@/lib/communications/dispatcher";
import { db } from "@/lib/db";
import { reservations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const inngest = new Inngest({ id: "hostra" });

const sendConfirmation = inngest.createFunction(
  {
    id: "send-reservation-confirmation",
    triggers: [{ event: "reservation/created" }],
  },
  async ({ event }) => {
    const { guestId, locationId, reservationId, date, time, partySize, confirmationToken } =
      event.data as Record<string, string>;

    await dispatchNotification("reservation_confirmation", {
      guestId,
      locationId,
      reservationId,
      date,
      time,
      partySize: Number(partySize),
      confirmationToken,
    }, ["sms", "email"]);
  }
);

const sendReminder = inngest.createFunction(
  {
    id: "send-reservation-reminder",
    triggers: [{ event: "reservation/reminder" }],
  },
  async ({ event }) => {
    const { reservationId } = event.data as Record<string, string>;

    const res = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
    });

    if (!res || res.status === "cancelled") return;

    await dispatchNotification("reservation_reminder", {
      guestId: res.guestId,
      locationId: res.locationId,
      reservationId: res.id,
      date: res.date,
      time: res.time,
      partySize: res.partySize,
    });

    await db
      .update(reservations)
      .set({ status: "reminded", remindedAt: new Date() })
      .where(eq(reservations.id, reservationId));
  }
);

const sendWaitlistReady = inngest.createFunction(
  {
    id: "send-waitlist-ready",
    triggers: [{ event: "waitlist/ready" }],
  },
  async ({ event }) => {
    const { guestId, locationId, waitlistEntryId } = event.data as Record<string, string>;

    await dispatchNotification("waitlist_ready", {
      guestId,
      locationId,
      waitlistEntryId,
    });
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendConfirmation, sendReminder, sendWaitlistReady],
});
