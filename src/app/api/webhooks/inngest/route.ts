import { serve } from "inngest/next";
import { Inngest } from "inngest";
import { dispatchNotification } from "@/lib/communications/dispatcher";
import { supabase } from "@/lib/db";

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

    const { data: res, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .single();

    if (error || !res || res.status === "cancelled") return;

    await dispatchNotification("reservation_reminder", {
      guestId: res.guest_id,
      locationId: res.location_id,
      reservationId: res.id,
      date: res.date,
      time: res.time,
      partySize: res.party_size,
    });

    await supabase
      .from("reservations")
      .update({ status: "reminded", reminded_at: new Date().toISOString() })
      .eq("id", reservationId);
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
