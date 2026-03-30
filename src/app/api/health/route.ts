import { NextResponse } from "next/server";
import postgres from "postgres";

const PASSWORD = encodeURIComponent("HostraDB2026!");
const REF = "dlysjilrgkqaacoqppbw";

const CANDIDATES = [
  {
    label: "pooler-txn-workaround",
    url: `postgres://postgres.${REF}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?workaround=supabase-pooler.vercel`,
  },
  {
    label: "pooler-session-5432",
    url: `postgres://postgres.${REF}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  },
  {
    label: "env-var",
    url: process.env.DATABASE_URL || "not-set",
  },
];

export async function GET() {
  const results = [];

  for (const candidate of CANDIDATES) {
    if (candidate.url === "not-set") {
      results.push({ label: candidate.label, status: "error", message: "DATABASE_URL not set" });
      continue;
    }
    try {
      const sql = postgres(candidate.url, {
        prepare: false,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connect_timeout: 10,
        idle_timeout: 5,
      });
      const rows = await sql`SELECT count(*)::int as c FROM locations`;
      await sql.end();
      results.push({ label: candidate.label, status: "ok", locationCount: rows[0].c });
    } catch (error: any) {
      results.push({ label: candidate.label, status: "error", message: error.message, code: error.code });
    }
  }

  return NextResponse.json({ results });
}
