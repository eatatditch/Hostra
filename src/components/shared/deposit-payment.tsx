"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { trpc } from "@/lib/trpc/client";

const promiseByKey = new Map<string, Promise<Stripe | null>>();

function getStripePromiseFor(key: string | null | undefined) {
  if (!key) return Promise.resolve(null);
  const existing = promiseByKey.get(key);
  if (existing) return existing;
  const p = loadStripe(key);
  promiseByKey.set(key, p);
  return p;
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
  const { data: keyData, isLoading } = trpc.payment.getPublishableKey.useQuery();
  const publishableKey = keyData?.publishableKey ?? null;
  const promise = getStripePromiseFor(publishableKey);

  if (isLoading) {
    return (
      <div className="h-24 bg-surface-alt rounded-lg animate-pulse" />
    );
  }

  if (!publishableKey) {
    return (
      <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-4 text-sm text-status-error">
        Stripe is not configured. Ask the restaurant to add a publishable key in Settings → Payments.
      </div>
    );
  }

  return (
    <Elements
      stripe={promise}
      options={{ clientSecret, appearance: { theme: "stripe" } }}
    >
      <DepositForm
        amountCents={amountCents}
        returnUrl={returnUrl}
        onSuccess={onSuccess}
        publishableKey={publishableKey}
      />
    </Elements>
  );
}

function DepositForm({
  amountCents,
  returnUrl,
  onSuccess,
  publishableKey,
}: {
  amountCents: number;
  returnUrl: string;
  onSuccess?: () => void;
  publishableKey: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publishableKey) {
      setError(
        "Stripe is not configured on this environment. Contact the restaurant."
      );
    }
  }, [publishableKey]);

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
