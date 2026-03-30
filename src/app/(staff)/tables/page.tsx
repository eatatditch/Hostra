"use client";

import { TableGrid } from "@/components/dashboard/table-grid";

const DEMO_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

export default function TablesPage() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Table Management</h1>
        <p className="text-sm text-text-muted">
          Click a table to cycle its status
        </p>
      </div>
      <TableGrid locationId={DEMO_LOCATION_ID} />
    </div>
  );
}
