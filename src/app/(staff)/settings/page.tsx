"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-sm text-text-muted">
          Configure location, shifts, floor plans, and triggers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <p className="text-sm text-text-muted">
          Location management coming in V2.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Shifts</CardTitle>
        </CardHeader>
        <p className="text-sm text-text-muted">
          Configure brunch, dinner, and late-night shift hours, capacity, and
          slot duration.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger Configuration</CardTitle>
        </CardHeader>
        <p className="text-sm text-text-muted">
          Enable/disable triggers and adjust thresholds per location.
        </p>
      </Card>
    </div>
  );
}
