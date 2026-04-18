import Stripe from "stripe";
import { supabase } from "@/lib/db";

type PlatformStripeConfig = {
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
};

let cached: { key: string; client: Stripe } | null = null;
let configCache: { loadedAt: number; config: PlatformStripeConfig } | null = null;
const CONFIG_TTL_MS = 30_000;

async function loadDbConfig(): Promise<PlatformStripeConfig> {
  const { data } = await supabase
    .from("platform_settings")
    .select("stripe_secret_key, stripe_publishable_key, stripe_webhook_secret")
    .limit(1)
    .maybeSingle();
  return {
    secretKey: (data?.stripe_secret_key as string) || null,
    publishableKey: (data?.stripe_publishable_key as string) || null,
    webhookSecret: (data?.stripe_webhook_secret as string) || null,
  };
}

export async function getStripeConfig(): Promise<PlatformStripeConfig> {
  const now = Date.now();
  if (configCache && now - configCache.loadedAt < CONFIG_TTL_MS) {
    return configCache.config;
  }
  let dbConfig: PlatformStripeConfig = {
    secretKey: null,
    publishableKey: null,
    webhookSecret: null,
  };
  try {
    dbConfig = await loadDbConfig();
  } catch {
    // platform_settings table may not exist yet in some envs; fall through to env.
  }
  const config: PlatformStripeConfig = {
    secretKey: dbConfig.secretKey || process.env.STRIPE_SECRET_KEY || null,
    publishableKey:
      dbConfig.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    webhookSecret:
      dbConfig.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || null,
  };
  configCache = { loadedAt: now, config };
  return config;
}

export function invalidateStripeConfigCache() {
  configCache = null;
  cached = null;
}

export async function getStripe(): Promise<Stripe> {
  const { secretKey } = await getStripeConfig();
  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Add a secret key in Settings → Payments or set STRIPE_SECRET_KEY."
    );
  }
  if (cached && cached.key === secretKey) return cached.client;
  const client = new Stripe(secretKey);
  cached = { key: secretKey, client };
  return client;
}
