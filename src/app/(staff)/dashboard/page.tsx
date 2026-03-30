"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge, Button } from "@/components/ui";
import { ReservationList } from "@/components/dashboard/reservation-list";
import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";
import { TableGrid } from "@/components/dashboard/table-grid";
import { useLocation } from "@/components/dashboard/location-provider";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DashboardPage() {
  const { locationId, locationName, isLoading } = useLocation();
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  function shiftDate(days: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  }

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  if (isLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

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
        <div className="xl:col-span-2 space-y-6">
          <ReservationList locationId={locationId} date={selectedDate} />
        </div>
        <div className="space-y-6">
          <WaitlistPanel locationId={locationId} />
          <TableGrid locationId={locationId} />
        </div>
      </div>
    </div>
  );
}
