import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json({ status: "error", message: "Supabase env vars not set", url: !!url, key: !!key });
    }

    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("locations").select("id, name, slug");

    if (error) {
      return NextResponse.json({ status: "error", message: error.message, code: error.code });
    }

    return NextResponse.json({ status: "ok", locations: data });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message });
  }
}
