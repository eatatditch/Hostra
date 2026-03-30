"use client";

import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";

const DEMO_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

export default function WaitlistPage() {
  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Waitlist</h1>
        <p className="text-sm text-text-muted">Manage walk-in waitlist</p>
      </div>
      <WaitlistPanel locationId={DEMO_LOCATION_ID} />
    </div>
  );
}
