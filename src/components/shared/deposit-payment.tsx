"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (stripePromise) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    stripePromise = Promise.resolve(null);
    return stripePromise;
  }
  stripePromise = loadStripe(key);
  return stripePromise;
}

export function DepositPayment({
  clientSecret,
  amountCents,
  returnUrl,
  onSuccess,
}: {
  clientSecret: string;
  amountCents: number;
  returnUrl: string;
  onSuccess?: () => void;
}) {
  const promise = getStripePromise();

  return (
    <Elements
      stripe={promise}
      options={{ clientSecret, appearance: { theme: "stripe" } }}
    >
      <DepositForm
        amountCents={amountCents}
        returnUrl={returnUrl}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}

function DepositForm({
  amountCents,
  returnUrl,
  onSuccess,
}: {
  amountCents: number;
  returnUrl: string;
  onSuccess?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setError(
        "Stripe is not configured on this environment. Contact the restaurant."
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Card authorization failed.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSuccess?.();
  }

  const dollars = (amountCents / 100).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-ditch-blue/5 p-4 text-sm">
        <p className="font-semibold text-ditch-charcoal">
          Hold ${dollars} per reservation
        </p>
        <p className="text-xs text-text-muted mt-1">
          Your card is authorized but not charged. It's only captured if you
          don't show up or cancel late.
        </p>
      </div>
      <PaymentElement />
      {error && (
        <p className="text-sm text-status-error bg-status-error/5 p-2 rounded-xl text-center">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3.5 rounded-xl bg-ditch-orange text-white font-semibold text-lg hover:bg-ditch-orange-dark disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
      >
        {submitting ? "Authorizing..." : `Authorize $${dollars} & Confirm`}
      </button>
    </form>
  );
}
