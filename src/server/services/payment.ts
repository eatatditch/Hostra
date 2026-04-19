import { supabase } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import type {
  CreatePaymentIntentInput,
  CapturePaymentInput,
  RefundPaymentInput,
} from "@/lib/validators/payment";

export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  const stripe = await getStripe();

  const intent = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency,
    capture_method: input.captureMethod,
    metadata: {
      guest_id: input.guestId,
      reservation_id: input.reservationId || "",
      payment_type: input.type,
      ...(input.metadata || {}),
    },
  });

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      guest_id: input.guestId,
      reservation_id: input.reservationId || null,
      amount_cents: input.amountCents,
      currency: input.currency,
      stripe_payment_intent_id: intent.id,
      status: intent.status,
      type: input.type,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    payment,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

export async function capturePayment(input: CapturePaymentInput) {
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .single();

  if (error || !payment) throw new Error("NOT_FOUND");

  const stripe = await getStripe();
  const intent = await stripe.paymentIntents.capture(
    payment.stripe_payment_intent_id,
    input.amountCents
      ? { amount_to_capture: input.amountCents }
      : undefined
  );

  const { data: updated, error: updateError } = await supabase
    .from("payments")
    .update({ status: intent.status })
    .eq("id", input.paymentId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function captureDepositForNoShow(reservationId: string) {
  const { data: pending, error } = await supabase
    .from("payments")
    .select("id, stripe_payment_intent_id")
    .eq("reservation_id", reservationId)
    .eq("type", "deposit")
    .eq("status", "requires_capture");

  if (error || !pending || pending.length === 0) return [];

  const stripe = await getStripe();
  const captured: Array<{ paymentId: string; status: string }> = [];

  for (const row of pending) {
    try {
      const intent = await stripe.paymentIntents.capture(
        row.stripe_payment_intent_id
      );
      await supabase
        .from("payments")
        .update({ status: intent.status })
        .eq("id", row.id);
      captured.push({ paymentId: row.id, status: intent.status });
    } catch (err) {
      // Best-effort: don't fail the no-show flow on Stripe errors.
      console.error("captureDepositForNoShow failed", row.id, err);
    }
  }

  return captured;
}

export async function refundDepositForCancellation(
  reservationId: string,
  refundPercent: number
) {
  const clamped = Math.max(0, Math.min(100, Math.floor(refundPercent)));
  if (clamped === 0) return [];

  const { data: deposits, error } = await supabase
    .from("payments")
    .select("id, stripe_payment_intent_id, amount_cents, status")
    .eq("reservation_id", reservationId)
    .eq("type", "deposit")
    .in("status", ["requires_capture", "succeeded"]);

  if (error || !deposits || deposits.length === 0) return [];

  const stripe = await getStripe();
  const results: Array<{ paymentId: string; status: string }> = [];

  for (const row of deposits) {
    const refundAmount = Math.round((row.amount_cents * clamped) / 100);
    if (refundAmount <= 0) continue;

    try {
      if (row.status === "requires_capture") {
        if (clamped >= 100) {
          // Full refund before capture — cancel the authorization outright.
          const intent = await stripe.paymentIntents.cancel(
            row.stripe_payment_intent_id
          );
          await supabase
            .from("payments")
            .update({ status: intent.status })
            .eq("id", row.id);
          results.push({ paymentId: row.id, status: intent.status });
        } else {
          // Partial refund: capture only the non-refunded portion. Stripe
          // voids the remaining authorization automatically.
          const captureAmount = row.amount_cents - refundAmount;
          const intent = await stripe.paymentIntents.capture(
            row.stripe_payment_intent_id,
            { amount_to_capture: captureAmount }
          );
          await supabase
            .from("payments")
            .update({ status: intent.status })
            .eq("id", row.id);
          results.push({ paymentId: row.id, status: intent.status });
        }
      } else if (row.status === "succeeded") {
        await stripe.refunds.create({
          payment_intent: row.stripe_payment_intent_id,
          amount: refundAmount,
          reason: "requested_by_customer",
        });
        const intent = await stripe.paymentIntents.retrieve(
          row.stripe_payment_intent_id
        );
        await supabase
          .from("payments")
          .update({ status: intent.status })
          .eq("id", row.id);
        results.push({ paymentId: row.id, status: intent.status });
      }
    } catch (err) {
      // Best-effort: never block the cancellation flow on Stripe errors.
      console.error(
        "refundDepositForCancellation failed",
        row.id,
        err
      );
    }
  }

  return results;
}

export async function refundPayment(input: RefundPaymentInput) {
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .single();

  if (error || !payment) throw new Error("NOT_FOUND");

  const stripe = await getStripe();
  await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: input.amountCents,
    reason: input.reason,
  });

  const intent = await stripe.paymentIntents.retrieve(
    payment.stripe_payment_intent_id
  );

  const { data: updated, error: updateError } = await supabase
    .from("payments")
    .update({ status: intent.status })
    .eq("id", input.paymentId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return updated;
}

export async function syncPaymentStatusByIntent(
  paymentIntentId: string,
  status: string
) {
  const { data: updated, error } = await supabase
    .from("payments")
    .update({ status })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("reservation_id, type")
    .single();

  if (error) {
    // No matching payment row — nothing to reconcile.
    return;
  }

  // When a deposit PaymentIntent authorizes (requires_capture) or is captured
  // (succeeded), flip a linked pending_deposit reservation to confirmed.
  if (
    updated?.reservation_id &&
    updated.type === "deposit" &&
    (status === "requires_capture" || status === "succeeded")
  ) {
    await supabase
      .from("reservations")
      .update({
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", updated.reservation_id)
      .eq("status", "pending_deposit");
  }
}
