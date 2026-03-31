import { supabase } from "@/lib/db";

interface TemplateVars {
  guest_name: string;
  date: string;
  time: string;
  party_size: string;
  location_name: string;
  confirmation_link?: string;
  waitlist_link?: string;
  position?: string;
  estimated_wait?: string;
  [key: string]: string | undefined;
}

const DEFAULT_TEMPLATES: Record<string, { sms: string; email_subject?: string; email_body?: string }> = {
  reservation_confirmation: {
    sms: "Hi {{guest_name}}! Your reservation at {{location_name}} is confirmed for {{date}} at {{time}}, party of {{party_size}}. Manage: {{confirmation_link}}",
    email_subject: "Reservation Confirmed — {{location_name}}",
    email_body: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
      <h2 style="color:#cd6028">Reservation Confirmed</h2>
      <p>Hi {{guest_name}},</p>
      <p>We're looking forward to seeing you at <strong>{{location_name}}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666">Date</td><td style="padding:8px 0;font-weight:600">{{date}}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Time</td><td style="padding:8px 0;font-weight:600">{{time}}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Party Size</td><td style="padding:8px 0;font-weight:600">{{party_size}}</td></tr>
      </table>
      <p><a href="{{confirmation_link}}" style="color:#cd6028">Manage your reservation</a></p>
      <p style="color:#999;font-size:12px;margin-top:24px">— The Ditch Team</p>
    </div>`,
  },
  reservation_reminder: {
    sms: "Reminder: Your table at {{location_name}} is in {{time}}. Party of {{party_size}}. See you soon!",
  },
  waitlist_added: {
    sms: "Hi {{guest_name}}! You're on the waitlist at {{location_name}}. Position: #{{position}}, estimated wait: ~{{estimated_wait}}. Check status: {{waitlist_link}}",
  },
  waitlist_ready: {
    sms: "{{guest_name}}, your table at {{location_name}} is ready! Please head to the host stand. We'll hold it for 5 minutes.",
  },
  post_visit: {
    sms: "Thanks for dining with us at {{location_name}}, {{guest_name}}! We hope to see you again soon.",
  },
};

export function renderTemplate(
  template: string,
  vars: TemplateVars
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

export async function getTemplate(
  locationId: string,
  key: string,
  channel: "sms" | "email"
): Promise<string | null> {
  // Check for custom template in DB
  const { data: custom } = await supabase
    .from("communication_templates")
    .select("body")
    .eq("location_id", locationId)
    .eq("key", key)
    .eq("channel", channel)
    .eq("active", true)
    .single();

  if (custom) return custom.body;

  // Fall back to default templates
  const defaults = DEFAULT_TEMPLATES[key];
  if (!defaults) return null;

  if (channel === "sms") return defaults.sms;
  if (channel === "email") return defaults.email_body || null;

  return null;
}

export function getDefaultEmailSubject(key: string): string | null {
  return DEFAULT_TEMPLATES[key]?.email_subject || null;
}
