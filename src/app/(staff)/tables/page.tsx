"use client";

import { TableGrid } from "@/components/dashboard/table-grid";
import { useLocation } from "@/components/dashboard/location-provider";

export default function TablesPage() {
  const { locationId, isLoading } = useLocation();

  if (isLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Table Management</h1>
        <p className="text-sm text-text-muted">
          Click a table to cycle its status
        </p>
      </div>
      <TableGrid locationId={locationId} />
    </div>
  );
}
