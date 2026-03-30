import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ status: "error", message: "DATABASE_URL not set" });
    }

    // Show masked URL so we can verify the format
    const url = new URL(dbUrl);
    const masked = `${url.protocol}//${url.username}:***@${url.host}${url.pathname}`;

    const sql = postgres(dbUrl, { prepare: false, ssl: "require", max: 1, connect_timeout: 10 });

    const result = await sql`SELECT id, name FROM locations LIMIT 5`;
    await sql.end();

    return NextResponse.json({
      status: "ok",
      connectionString: masked,
      locationCount: result.length,
      locations: result,
    });
  } catch (error: any) {
    const dbUrl = process.env.DATABASE_URL;
    let masked = "not set";
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        masked = `${url.protocol}//${url.username}:***@${url.host}${url.pathname}`;
      } catch { masked = "invalid URL format"; }
    }
    return NextResponse.json({
      status: "error",
      connectionString: masked,
      message: error.message,
      code: error.code,
    });
  }
}
