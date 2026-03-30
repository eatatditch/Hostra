"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  Clock,
  UserCircle,
  MessageSquare,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Host Stand", href: "/dashboard/host", icon: Users },
  { label: "Waitlist", href: "/dashboard/host?tab=waitlist", icon: Clock },
  { label: "Guests", href: "/dashboard/guests", icon: UserCircle },
  {
    label: "Communications",
    href: "/dashboard/communications",
    icon: MessageSquare,
  },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href.includes("?")) {
    return pathname === href.split("?")[0];
  }
  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ditch-cream">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ditch-blue-dark transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
          <Link href="/dashboard/host" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-white">
              Ditch
            </span>
            <span className="text-[10px] font-medium text-ditch-orange tracking-widest uppercase">
              Hostra
            </span>
          </Link>
          <button
            className="lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white border-l-2 border-ditch-orange"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-ditch-orange flex items-center justify-center text-white text-xs font-semibold">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                Jane Doe
              </p>
              <p className="text-xs text-white/50 truncate">Host Manager</p>
            </div>
            <button className="text-white/40 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-ditch-sand-dark bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-ditch-charcoal"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Location selector */}
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-lg border border-ditch-sand-dark px-3 py-2 text-sm font-medium text-ditch-charcoal hover:bg-ditch-sand transition-colors"
                onClick={() => setLocationOpen(!locationOpen)}
              >
                <span className="h-2 w-2 rounded-full bg-ditch-green" />
                Ditch - Montauk
                <ChevronDown className="h-4 w-4 text-ditch-gray" />
              </button>
              {locationOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-ditch-sand-dark bg-white shadow-lg py-1 z-50">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ditch-charcoal hover:bg-ditch-sand"
                    onClick={() => setLocationOpen(false)}
                  >
                    <span className="h-2 w-2 rounded-full bg-ditch-green" />
                    Ditch - Montauk
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ditch-gray hover:bg-ditch-sand"
                    onClick={() => setLocationOpen(false)}
                  >
                    <span className="h-2 w-2 rounded-full bg-ditch-gray-light" />
                    Ditch - Amagansett
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-ditch-gray" />
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-ditch-orange text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
