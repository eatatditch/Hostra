"use client";

import { trpc } from "@/lib/trpc/client";

interface HostOSLogoProps {
  className?: string;
  height?: number;
}

export function HostOSLogo({ className, height = 32 }: HostOSLogoProps) {
  const { data: brand } = trpc.table.getBrandSettings.useQuery();

  if (brand?.platform_logo_url) {
    return (
      <img
        src={brand.platform_logo_url}
        alt="HostOS"
        className={className}
        style={{ height, objectFit: "contain" }}
      />
    );
  }

  // Fallback text
  return (
    <span
      className={className}
      style={{ fontSize: height * 0.7, fontWeight: 700, lineHeight: 1 }}
    >
      <span style={{ color: "#2d6a9f" }}>Host</span>
      <span style={{ color: "#e8751a" }}>OS</span>
    </span>
  );
}

// Static version for server components (no tRPC)
export function HostOSLogoStatic({ className, height = 32 }: HostOSLogoProps) {
  return (
    <span
      className={className}
      style={{ fontSize: height * 0.7, fontWeight: 700, lineHeight: 1 }}
    >
      <span style={{ color: "#2d6a9f" }}>Host</span>
      <span style={{ color: "#e8751a" }}>OS</span>
    </span>
  );
}
