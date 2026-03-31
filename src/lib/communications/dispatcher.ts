import { sendSms } from "./sms";
import { sendEmail } from "./email";
import { renderTemplate, getTemplate, getDefaultEmailSubject } from "./templates";
import { supabase } from "@/lib/db";
import { format, parse } from "date-fns";

interface DispatchContext {
  guestId: string;
  locationId: string;
  reservationId?: string;
  waitlistEntryId?: string;
  date?: string;
  time?: string;
  partySize?: number;
  position?: number;
  estimatedWait?: number;
  confirmationToken?: string;
  checkToken?: string;
}

export async function dispatchNotification(
  templateKey: string,
  ctx: DispatchContext,
  channels: ("sms" | "email")[] = ["sms"]
) {
  const { data: guest } = await supabase
    .from("guests")
    .select("*")
    .eq("id", ctx.guestId)
    .single();
  if (!guest) return;

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("id", ctx.locationId)
    .single();
  if (!location) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const vars = {
    guest_name: guest.first_name,
    date: ctx.date
      ? format(parse(ctx.date, "yyyy-MM-dd", new Date()), "EEEE, MMMM d")
      : "",
    time: ctx.time || "",
    party_size: ctx.partySize?.toString() || "",
    location_name: location.name,
    confirmation_link: ctx.confirmationToken
      ? `${appUrl}/booking/${ctx.confirmationToken}`
      : "",
    waitlist_link: ctx.checkToken
      ? `${appUrl}/waitlist-status/${ctx.checkToken}`
      : "",
    position: ctx.position?.toString() || "",
    estimated_wait: ctx.estimatedWait ? `${ctx.estimatedWait} min` : "",
  };

  for (const channel of channels) {
    const template = await getTemplate(ctx.locationId, templateKey, channel);
    if (!template) continue;

    const content = renderTemplate(template, vars);

    if (channel === "sms" && !guest.sms_opt_out) {
      await sendSms({
        to: guest.phone,
        body: content,
        guestId: guest.id,
        locationId: ctx.locationId,
        templateKey,
        relatedType: ctx.reservationId ? "reservation" : ctx.waitlistEntryId ? "waitlist" : "manual",
        relatedId: ctx.reservationId || ctx.waitlistEntryId,
      });
    }

    if (channel === "email" && guest.email) {
      const subject = renderTemplate(
        getDefaultEmailSubject(templateKey) || `Update from ${location.name}`,
        vars
      );
      await sendEmail({
        to: guest.email,
        subject,
        html: content,
        guestId: guest.id,
        locationId: ctx.locationId,
        templateKey,
        relatedType: ctx.reservationId ? "reservation" : "manual",
        relatedId: ctx.reservationId,
      });
    }
  }
}
