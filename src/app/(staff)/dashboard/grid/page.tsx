"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocation } from "@/components/dashboard/location-provider";
import { ReservationGrid } from "@/components/dashboard/reservation-grid";

export default function GridPage() {
  return (
    <Suspense>
      <GridContent />
    </Suspense>
  );
}

function GridContent() {
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
    <div className="p-3 lg:p-4 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">Reservation Grid</h1>
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

      <ReservationGrid locationId={locationId} date={selectedDate} />
    </div>
  );
}
