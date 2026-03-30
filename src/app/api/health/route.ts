import { NextResponse } from "next/server";
import postgres from "postgres";

const CANDIDATES = [
  {
    label: "pooler-6543-dotuser",
    url: `postgresql://postgres.dlysjilrgkqaacoqppbw:${encodeURIComponent("HostraDB2026!")}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  },
  {
    label: "pooler-5432-dotuser",
    url: `postgresql://postgres.dlysjilrgkqaacoqppbw:${encodeURIComponent("HostraDB2026!")}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  },
  {
    label: "pooler-6543-plain",
    url: `postgresql://postgres:${encodeURIComponent("HostraDB2026!")}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  },
  {
    label: "direct-5432",
    url: `postgresql://postgres:${encodeURIComponent("HostraDB2026!")}@db.dlysjilrgkqaacoqppbw.supabase.co:5432/postgres`,
  },
];

export async function GET() {
  const results = [];

  for (const candidate of CANDIDATES) {
    try {
      const sql = postgres(candidate.url, {
        prepare: false,
        ssl: "require",
        max: 1,
        connect_timeout: 8,
      });
      const rows = await sql`SELECT count(*)::int as c FROM locations`;
      await sql.end();
      results.push({
        label: candidate.label,
        status: "ok",
        locationCount: rows[0].c,
      });
    } catch (error: any) {
      results.push({
        label: candidate.label,
        status: "error",
        message: error.message,
        code: error.code,
      });
    }
  }

  return NextResponse.json({ results });
}
