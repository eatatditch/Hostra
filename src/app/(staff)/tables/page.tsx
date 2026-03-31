"use client";

import { FloorPlan } from "@/components/dashboard/floor-plan";
import { useLocation } from "@/components/dashboard/location-provider";

export default function TablesPage() {
  const { locationId, isLoading } = useLocation();

  if (isLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Floor Plan</h1>
        <p className="text-sm text-text-muted">
          Click a table to cycle its status. Manage layout in Settings.
        </p>
      </div>
      <FloorPlan locationId={locationId} />
    </div>
  );
}
