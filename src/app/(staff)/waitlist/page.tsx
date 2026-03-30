"use client";

import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";
import { useLocation } from "@/components/dashboard/location-provider";

export default function WaitlistPage() {
  const { locationId, isLoading } = useLocation();

  if (isLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Waitlist</h1>
        <p className="text-sm text-text-muted">Manage walk-in waitlist</p>
      </div>
      <WaitlistPanel locationId={locationId} />
    </div>
  );
}
