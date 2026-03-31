import { supabase } from "@/lib/db";

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
  const { data: comm, error: insertError } = await supabase
    .from("communications")
    .insert({
      guest_id: params.guestId,
      location_id: params.locationId,
      channel: "email",
      direction: "outbound",
      template_key: params.templateKey || null,
      content: params.html,
      status: "queued",
      related_type: params.relatedType || null,
      related_id: params.relatedId || null,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.warn("Resend not configured, skipping email send");
      await supabase
        .from("communications")
        .update({ status: "failed" })
        .eq("id", comm.id);
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
      await supabase
        .from("communications")
        .update({
          status: "sent",
          external_id: result.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", comm.id);
    } else {
      await supabase
        .from("communications")
        .update({ status: "failed" })
        .eq("id", comm.id);
    }

    return comm;
  } catch (error) {
    await supabase
      .from("communications")
      .update({ status: "failed" })
      .eq("id", comm.id);
    throw error;
  }
}
