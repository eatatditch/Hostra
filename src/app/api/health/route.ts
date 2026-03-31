import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const test = url.searchParams.get("test");

  // Test staff creation flow
  if (test === "auth") {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({
          status: "error",
          message: "Missing env vars",
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceKey,
          keyPrefix: serviceKey?.slice(0, 20),
        });
      }

      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Try listing users to verify admin access works
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1 });

      if (listError) {
        return NextResponse.json({
          status: "error",
          step: "listUsers",
          message: listError.message,
        });
      }

      return NextResponse.json({
        status: "ok",
        userCount: users.users.length,
        adminApiWorks: true,
      });
    } catch (error: any) {
      return NextResponse.json({
        status: "error",
        message: error.message,
        stack: error.stack?.split("\n").slice(0, 3),
      });
    }
  }

  // Default: test DB
  const { data, error } = await supabase.from("locations").select("id, name");
  if (error) return NextResponse.json({ status: "error", message: error.message });
  return NextResponse.json({ status: "ok", locations: data });
}
