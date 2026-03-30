import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ status: "error", message: "DATABASE_URL not set" });
    }

    const masked = dbUrl.replace(/:([^@]+)@/, ":***@");

    // Raw postgres connection test — bypass Drizzle
    const sql = postgres(dbUrl, { prepare: false, ssl: "prefer", max: 1 });

    const result = await sql`SELECT id, name FROM locations LIMIT 5`;
    await sql.end();

    return NextResponse.json({
      status: "ok",
      connectionString: masked,
      locationCount: result.length,
      locations: result,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message,
      code: error.code,
      stack: error.stack?.split("\n").slice(0, 5),
    });
  }
}
