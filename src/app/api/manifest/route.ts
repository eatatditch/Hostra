import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: brand } = await supabase
    .from("brand_settings")
    .select("app_icon_url")
    .limit(1)
    .single();

  const iconUrl = brand?.app_icon_url || "/icons/icon-512.png";

  const manifest = {
    name: "HostOS",
    short_name: "HostOS",
    description: "Restaurant Hospitality Operating System",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#325269",
    orientation: "any",
    icons: [
      {
        src: iconUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
