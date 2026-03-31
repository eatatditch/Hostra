"use client";

import { trpc } from "@/lib/trpc/client";

type LogoSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { height: number; maxWidth: number }> = {
  xs: { height: 28, maxWidth: 140 },   // footer "powered by"
  sm: { height: 50, maxWidth: 220 },   // sidebar
  md: { height: 120, maxWidth: 500 },  // login page
  lg: { height: 160, maxWidth: 600 },  // landing / hero
};

interface HostOSLogoProps {
  className?: string;
  size?: LogoSize;
}

export function HostOSLogo({ className, size = "sm" }: HostOSLogoProps) {
  const { data: brand } = trpc.table.getBrandSettings.useQuery();
  const { height, maxWidth } = SIZES[size];

  if (brand?.platform_logo_url) {
    return (
      <img
        src={brand.platform_logo_url}
        alt="HostOS"
        className={className}
        style={{ height, maxWidth, objectFit: "contain" }}
      />
    );
  }

  return <HostOSText className={className} size={size} />;
}

export function HostOSLogoStatic({ className, size = "sm" }: HostOSLogoProps) {
  return <HostOSText className={className} size={size} />;
}

function HostOSText({ className, size = "sm" }: HostOSLogoProps) {
  const { height } = SIZES[size || "sm"];
  return (
    <span className={className} style={{ fontSize: height * 0.7, fontWeight: 700, lineHeight: 1 }}>
      <span style={{ color: "#2d6a9f" }}>Host</span>
      <span style={{ color: "#e8751a" }}>OS</span>
    </span>
  );
}
