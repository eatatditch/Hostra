"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/waitlist", label: "Waitlist", icon: ListOrdered },
  { href: "/tables", label: "Tables", icon: Grid3X3 },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function StaffNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { locationId, locationName, setLocation, locations } = useLocation();

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-white z-30">
        <div className="px-6 py-5 border-b border-border">
          <Link href="/dashboard">
            <h1 className="text-2xl font-display font-bold text-ditch-charcoal">
              Hostra
            </h1>
          </Link>
        </div>

        {/* Location switcher */}
        {locations.length > 0 && (
          <div className="px-3 py-3 border-b border-border">
            <select
              value={locationId}
              onChange={(e) => {
                const loc = locations.find((l) => l.id === e.target.value);
                if (loc) setLocation(loc.id, loc.name);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-alt hover:text-text"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text transition-colors w-full cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-border z-30">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 6).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors",
                  active ? "text-primary" : "text-text-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile location bar */}
      {locations.length > 1 && (
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-border px-4 py-2">
          <select
            value={locationId}
            onChange={(e) => {
              const loc = locations.find((l) => l.id === e.target.value);
              if (loc) setLocation(loc.id, loc.name);
            }}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-alt font-medium cursor-pointer"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
