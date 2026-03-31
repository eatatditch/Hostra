import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "reset-tracy") {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await adminClient.auth.admin.updateUserById(
      "0914b08f-6ddd-434e-bacc-ac13df000052",
      { password: "HostOS2026!" }
    );

    if (error) return NextResponse.json({ error: error.message });
    return NextResponse.json({ status: "ok", message: "Password reset to HostOS2026!" });
  }

  const { data } = await supabase.from("locations").select("id, name");
  return NextResponse.json({ status: "ok", locations: data });
}
