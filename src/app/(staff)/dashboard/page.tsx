"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { ReservationList } from "@/components/dashboard/reservation-list";
import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";
import { TableGrid } from "@/components/dashboard/table-grid";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

// TODO: Get from auth session
const DEMO_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  function shiftDate(days: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  }

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Host Stand</h1>
          <p className="text-sm text-text-muted">
            {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
            >
              Today
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Reservations — takes 2 cols on XL */}
        <div className="xl:col-span-2 space-y-6">
          <ReservationList
            locationId={DEMO_LOCATION_ID}
            date={selectedDate}
          />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <WaitlistPanel locationId={DEMO_LOCATION_ID} />
          <TableGrid locationId={DEMO_LOCATION_ID} />
        </div>
      </div>
    </div>
  );
}
