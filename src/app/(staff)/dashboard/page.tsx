"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui";
import { HostStand } from "@/components/dashboard/host-stand";
import { useLocation } from "@/components/dashboard/location-provider";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { locationId, isLoading } = useLocation();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(initialDate);

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
    <div className="p-3 lg:p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">Host Stand</h1>
          <p className="text-xs text-text-muted">
            {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
              Today
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <HostStand locationId={locationId} date={selectedDate} />
    </div>
  );
}
