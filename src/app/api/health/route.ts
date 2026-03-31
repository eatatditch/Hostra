import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data, error } = await supabase.from("locations").select("id, name");
  if (error) return NextResponse.json({ status: "error", message: error.message });
  return NextResponse.json({ status: "ok", locations: data });
}
