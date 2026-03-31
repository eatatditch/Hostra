"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import { Card, CardHeader, CardTitle, Button, Badge, Modal, Input } from "@/components/ui";
import { ChevronLeft, ChevronRight, Ban, Check } from "lucide-react";
import { format } from "date-fns";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const { locationId, isLoading: locLoading } = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [blockingDate, setBlockingDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data: summary } = trpc.reservation.getMonthSummary.useQuery(
    { locationId, year, month },
    { enabled: !!locationId }
  );

  const blockMutation = trpc.reservation.blockDate.useMutation();
  const unblockMutation = trpc.reservation.unblockDate.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.reservation.getMonthSummary.invalidate({ locationId, year, month });
  }

  function shiftMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  }

  async function handleBlock() {
    if (!blockingDate) return;
    await blockMutation.mutateAsync({
      locationId,
      date: blockingDate,
      reason: blockReason || undefined,
    });
    setBlockingDate(null);
    setBlockReason("");
    invalidate();
  }

  async function handleUnblock(date: string) {
    await unblockMutation.mutateAsync({ locationId, date });
    invalidate();
  }

  function handleDayClick(dateStr: string) {
    // Navigate to dashboard with that date
    router.push(`/dashboard?date=${dateStr}`);
  }

  if (locLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = format(now, "yyyy-MM-dd");

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Calendar</h1>
          <p className="text-sm text-text-muted">
            Reservation overview and day management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold w-36 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card padding="sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-text-muted py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={i} className="h-20" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayData = summary?.reservations?.[dateStr];
            const isBlocked = summary?.blockedDates?.[dateStr] !== undefined;
            const blockedReason = summary?.blockedDates?.[dateStr];

            return (
              <div
                key={i}
                className={`h-20 rounded-lg border p-1.5 cursor-pointer transition-colors ${
                  isBlocked
                    ? "bg-status-error/5 border-status-error/20"
                    : isToday
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface-alt"
                }`}
                onClick={() => !isBlocked && handleDayClick(dateStr)}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? "text-primary" : "text-text"
                    }`}
                  >
                    {day}
                  </span>
                  {isBlocked ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnblock(dateStr);
                      }}
                      className="cursor-pointer"
                      title={`Blocked: ${blockedReason || "No reason"}\nClick to unblock`}
                    >
                      <Ban className="h-3.5 w-3.5 text-status-error" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBlockingDate(dateStr);
                      }}
                      className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      title="Block this date"
                    >
                      <Ban className="h-3 w-3 text-text-muted" />
                    </button>
                  )}
                </div>

                {dayData && !isBlocked && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs font-medium text-text">
                      {dayData.confirmed} res
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {dayData.covers} covers
                    </p>
                  </div>
                )}

                {isBlocked && (
                  <p className="text-[10px] text-status-error mt-1 font-medium">
                    Blocked
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-primary bg-primary/5" />
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-border bg-white" />
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-status-error/20 bg-status-error/5" />
          Blocked
        </span>
        <span className="text-text-muted">Hover day → click ban icon to block</span>
      </div>

      {/* Block Date Modal */}
      <Modal
        open={!!blockingDate}
        onClose={() => { setBlockingDate(null); setBlockReason(""); }}
        title={`Block ${blockingDate ? format(new Date(blockingDate + "T00:00:00"), "EEEE, MMMM d") : ""}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleBlock(); }} className="space-y-4">
          <p className="text-sm text-text-muted">
            Blocking this date will prevent new guest reservations. Existing reservations will not be cancelled.
          </p>
          <Input
            label="Reason (optional)"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="e.g. Private event, Holiday, Maintenance"
          />
          <Button
            type="submit"
            variant="danger"
            className="w-full"
            loading={blockMutation.isPending}
          >
            Block Reservations
          </Button>
        </form>
      </Modal>
    </div>
  );
}
