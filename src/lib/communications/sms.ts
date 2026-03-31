import { supabase } from "@/lib/db";

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
  const { data: comm, error: insertError } = await supabase
    .from("communications")
    .insert({
      guest_id: params.guestId,
      location_id: params.locationId,
      channel: "sms",
      direction: "outbound",
      template_key: params.templateKey || null,
      content: params.body,
      status: "queued",
      related_type: params.relatedType || null,
      related_id: params.relatedId || null,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio not configured, skipping SMS send");
      await supabase
        .from("communications")
        .update({ status: "failed" })
        .eq("id", comm.id);
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
      await supabase
        .from("communications")
        .update({
          status: "sent",
          external_id: result.sid,
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
