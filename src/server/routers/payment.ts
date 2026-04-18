import { z } from "zod";
import { router, publicProcedure, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import {
  createPaymentIntentSchema,
  capturePaymentSchema,
  refundPaymentSchema,
} from "@/lib/validators/payment";
import {
  createPaymentIntent,
  capturePayment,
  refundPayment,
} from "@/server/services/payment";
import { supabase } from "@/lib/db";
import { getStripe, getStripeConfig, invalidateStripeConfigCache } from "@/lib/stripe";

const MASK = (s: string | null) =>
  !s ? null : s.length <= 8 ? `${s[0]}…${s[s.length - 1]}` : `${s.slice(0, 7)}…${s.slice(-4)}`;

export const paymentRouter = router({
  createIntent: publicProcedure
    .input(createPaymentIntentSchema)
    .mutation(async ({ input }) => {
      return createPaymentIntent(input);
    }),

  capture: protectedProcedure
    .input(capturePaymentSchema)
    .mutation(async ({ input }) => {
      return capturePayment(input);
    }),

  refund: protectedProcedure
    .input(refundPaymentSchema)
    .mutation(async ({ input }) => {
      return refundPayment(input);
    }),

  // Public: guest booking page needs the publishable key at runtime so it
  // works without a NEXT_PUBLIC_* env var set at build time.
  getPublishableKey: publicProcedure.query(async () => {
    const { publishableKey } = await getStripeConfig();
    return { publishableKey };
  }),

  // Admin-only: report what's configured (masked) and which source provided it.
  getStripeStatus: roleProcedure("admin").query(async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("stripe_secret_key, stripe_publishable_key, stripe_webhook_secret, updated_at")
      .limit(1)
      .maybeSingle();
    const dbSecret = (data?.stripe_secret_key as string) || null;
    const dbPub = (data?.stripe_publishable_key as string) || null;
    const dbWh = (data?.stripe_webhook_secret as string) || null;

    const envSecret = process.env.STRIPE_SECRET_KEY || null;
    const envPub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
    const envWh = process.env.STRIPE_WEBHOOK_SECRET || null;

    const activeSecret = dbSecret || envSecret;

    let connection: { ok: boolean; error?: string; mode?: "test" | "live" | null } = {
      ok: false,
    };
    if (activeSecret) {
      try {
        const stripe = await getStripe();
        const account = await stripe.accounts.retrieve();
        connection = {
          ok: true,
          mode: account.charges_enabled === false ? null : activeSecret.startsWith("sk_live_") ? "live" : "test",
        };
      } catch (e: any) {
        connection = { ok: false, error: e?.message || "Stripe auth failed." };
      }
    }

    return {
      secret: {
        configured: Boolean(dbSecret || envSecret),
        source: dbSecret ? ("db" as const) : envSecret ? ("env" as const) : null,
        masked: MASK(dbSecret || envSecret),
      },
      publishable: {
        configured: Boolean(dbPub || envPub),
        source: dbPub ? ("db" as const) : envPub ? ("env" as const) : null,
        masked: MASK(dbPub || envPub),
      },
      webhook: {
        configured: Boolean(dbWh || envWh),
        source: dbWh ? ("db" as const) : envWh ? ("env" as const) : null,
      },
      connection,
      updatedAt: (data?.updated_at as string) || null,
    };
  }),

  // Admin-only: save Stripe keys to the platform_settings row. Empty string
  // clears the DB value and lets the env var take over.
  updateStripeKeys: roleProcedure("admin")
    .input(
      z.object({
        secretKey: z.string().optional(),
        publishableKey: z.string().optional(),
        webhookSecret: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.secretKey !== undefined) patch.stripe_secret_key = input.secretKey || null;
      if (input.publishableKey !== undefined) patch.stripe_publishable_key = input.publishableKey || null;
      if (input.webhookSecret !== undefined) patch.stripe_webhook_secret = input.webhookSecret || null;

      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("platform_settings")
          .update(patch)
          .eq("id", existing.id);
        if (error) {
          if (/relation .* does not exist/i.test(error.message)) {
            throw new Error(
              "platform_settings table is missing. Run `npm run db:push` against the deployed Supabase project."
            );
          }
          throw new Error(error.message);
        }
      } else {
        const { error } = await supabase.from("platform_settings").insert(patch);
        if (error) {
          if (/relation .* does not exist/i.test(error.message)) {
            throw new Error(
              "platform_settings table is missing. Run `npm run db:push` against the deployed Supabase project."
            );
          }
          throw new Error(error.message);
        }
      }

      invalidateStripeConfigCache();
      return { ok: true };
    }),
});
