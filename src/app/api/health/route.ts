import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({
        status: "error",
        message: "DATABASE_URL not set",
      });
    }

    const masked = dbUrl.replace(/:([^@]+)@/, ":***@");

    const result = await db.select({ id: locations.id, name: locations.name }).from(locations);

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
      detail: error.detail,
    });
  }
}
