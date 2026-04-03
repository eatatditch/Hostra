"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HostOSLogo } from "@/components/ui";
import { useLocation } from "./location-provider";
import {
  LayoutDashboard,
  ListOrdered,
  Grid3X3,
  Users,
  Settings,
  BarChart3,
  CalendarDays,
  LogOut,
  Shield,
  ChevronDown,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

const allNavItems = [
  { href: "/dashboard", label: "Host", icon: LayoutDashboard, roles: ["admin", "manager", "host"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["admin", "manager", "host"] },
  { href: "/waitlist", label: "Waitlist", icon: ListOrdered, roles: ["admin", "manager", "host"] },
  { href: "/guests", label: "Guests", icon: Users, roles: ["admin", "manager", "host"] },
  { href: "/tables", label: "Tables", icon: Grid3X3, roles: ["admin", "manager", "host"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager"] },
  { href: "/platform", label: "Platform", icon: Shield, roles: ["admin"], platformOnly: true },
];

export function StaffNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { locationId, locationName, setLocation, locations, userRole, isPlatformAdmin } = useLocation();
  const [showMore, setShowMore] = useState(false);

  const navItems = allNavItems.filter((item: any) => {
    if (item.platformOnly && !isPlatformAdmin) return false;
    return !userRole || item.roles.includes(userRole);
  });

  // Split into primary (shown in bottom bar) and overflow (in "more" menu)
  const primaryItems = navItems.slice(0, 5);
  const overflowItems = navItems.slice(5);

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Top bar: logo + location switcher */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-border">
        <div className="flex items-center justify-between px-3 py-1.5">
          <Link href="/dashboard">
            <HostOSLogo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            {locations.length > 0 && (
              <select
                value={locationId}
                onChange={(e) => {
                  const loc = locations.find((l: any) => l.id === e.target.value);
                  if (loc) setLocation(loc.id, loc.name);
                }}
                className="px-2 py-1 text-xs rounded-lg border border-border bg-surface-alt font-medium cursor-pointer focus:outline-none max-w-[160px]"
              >
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-alt transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {primaryItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors min-w-[52px]",
                  active ? "text-primary" : "text-text-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* More button for overflow items */}
          {overflowItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMore(!showMore)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors min-w-[52px] cursor-pointer",
                  showMore || overflowItems.some((i) => pathname.startsWith(i.href))
                    ? "text-primary"
                    : "text-text-muted"
                )}
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform", showMore && "rotate-180")} />
                <span>More</span>
              </button>

              {showMore && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                  <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl border border-border shadow-lg z-50 py-2 min-w-[160px]">
                    {overflowItems.map((item) => {
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setShowMore(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                            active ? "text-primary bg-primary/5" : "text-text-muted hover:bg-surface-alt"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => { setShowMore(false); handleLogout(); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-alt w-full cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
