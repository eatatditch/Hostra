"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import { Card, CardHeader, CardTitle, Button, Badge, Modal, Input } from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Ban, Eye, Pencil } from "lucide-react";
import { format } from "date-fns";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CalendarPage() {
  const router = useRouter();
  const { locationId, isLoading: locLoading } = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Day detail modal
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data: summary } = trpc.reservation.getMonthSummary.useQuery(
    { locationId, year, month },
    { enabled: !!locationId }
  );

  const { data: shifts } = trpc.table.getShifts.useQuery(
    { locationId },
    { enabled: !!locationId }
  );

  const blockMutation = trpc.reservation.blockDate.useMutation();
  const unblockMutation = trpc.reservation.unblockDate.useMutation();
  const updateShiftMutation = trpc.table.updateShift.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.reservation.getMonthSummary.invalidate({ locationId, year, month });
    utils.table.getShifts.invalidate({ locationId });
  }

  function shiftMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  }

  async function handleBlockDate(dateStr: string) {
    await blockMutation.mutateAsync({
      locationId,
      date: dateStr,
      reason: blockReason || undefined,
    });
    setBlockReason("");
    invalidate();
  }

  async function handleUnblockDate(dateStr: string) {
    await unblockMutation.mutateAsync({ locationId, date: dateStr });
    invalidate();
  }

  async function handleToggleShift(shiftId: string, currentlyActive: boolean) {
    await updateShiftMutation.mutateAsync({
      shiftId,
      active: !currentlyActive,
    });
    invalidate();
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

  // Get shifts for the selected day
  const selectedDayObj = selectedDay ? new Date(selectedDay + "T00:00:00") : null;
  const selectedDow = selectedDayObj?.getDay();
  const selectedDayShifts = selectedDow !== undefined
    ? (shifts || []).filter((s: any) => s.day_of_week === selectedDow)
    : [];
  const selectedIsBlocked = selectedDay ? summary?.blockedDates?.[selectedDay] !== undefined : false;
  const selectedBlockReason = selectedDay ? summary?.blockedDates?.[selectedDay] : "";
  const selectedDayData = selectedDay ? summary?.reservations?.[selectedDay] : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Calendar</h1>
          <p className="text-sm text-text-muted">
            Click any day to manage reservations and shifts
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
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-text-muted py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="h-20" />;

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayData = summary?.reservations?.[dateStr];
            const isBlocked = summary?.blockedDates?.[dateStr] !== undefined;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(dateStr)}
                className={`h-20 rounded-lg border p-1.5 cursor-pointer transition-colors text-left ${
                  isBlocked
                    ? "bg-status-error/5 border-status-error/20 hover:bg-status-error/10"
                    : isToday
                      ? "border-primary bg-primary/5 hover:bg-primary/10"
                      : "border-border hover:bg-surface-alt"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-text"}`}>
                    {day}
                  </span>
                  {isBlocked && <Ban className="h-3 w-3 text-status-error" />}
                </div>

                {dayData && !isBlocked && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs font-medium text-text">{dayData.confirmed} res</p>
                    <p className="text-[10px] text-text-muted">{dayData.covers} covers</p>
                  </div>
                )}

                {isBlocked && (
                  <p className="text-[10px] text-status-error mt-1 font-medium">Blocked</p>
                )}
              </button>
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
      </div>

      {/* Day Detail Modal */}
      <Modal
        open={!!selectedDay}
        onClose={() => { setSelectedDay(null); setBlockReason(""); }}
        title={selectedDay ? format(new Date(selectedDay + "T00:00:00"), "EEEE, MMMM d, yyyy") : ""}
      >
        {selectedDay && (
          <div className="space-y-5">
            {/* Summary */}
            {selectedDayData && (
              <div className="bg-surface-alt rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Reservations</span>
                  <span className="font-medium">{selectedDayData.confirmed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Covers</span>
                  <span className="font-medium">{selectedDayData.covers}</span>
                </div>
              </div>
            )}

            {/* Block/Unblock Full Day */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Full Day</h3>
              {selectedIsBlocked ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-status-error/20 bg-status-error/5">
                  <div>
                    <p className="text-sm font-medium text-status-error flex items-center gap-1.5">
                      <Ban className="h-4 w-4" />
                      Reservations Blocked
                    </p>
                    {selectedBlockReason && (
                      <p className="text-xs text-text-muted mt-0.5">{selectedBlockReason}</p>
                    )}
                  </div>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => { handleUnblockDate(selectedDay); }}
                    loading={unblockMutation.isPending}
                  >
                    Unblock
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Reason (optional) e.g. Private event, Holiday"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    onClick={() => handleBlockDate(selectedDay)}
                    loading={blockMutation.isPending}
                  >
                    <Ban className="h-4 w-4" />
                    Block All Reservations for This Day
                  </Button>
                </div>
              )}
            </div>

            {/* Individual Shifts */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Shifts — {selectedDayObj ? DAY_NAMES[selectedDayObj.getDay()] : ""}
              </h3>
              {selectedDayShifts.length === 0 ? (
                <p className="text-xs text-text-muted italic">No shifts configured for this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayShifts.map((shift: any) => (
                    <div
                      key={shift.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        shift.active
                          ? "border-border"
                          : "border-status-warning/30 bg-status-warning/5"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{shift.name}</span>
                          {!shift.active && (
                            <Badge variant="warning">Paused</Badge>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {formatTime12h(shift.start_time)} – {formatTime12h(shift.end_time)} · {shift.max_covers} covers
                        </p>
                      </div>
                      <Button
                        variant={shift.active ? "ghost" : "accent"}
                        size="sm"
                        onClick={() => handleToggleShift(shift.id, shift.active)}
                        loading={updateShiftMutation.isPending}
                      >
                        {shift.active ? (
                          <>
                            <Ban className="h-3.5 w-3.5" />
                            Pause
                          </>
                        ) : (
                          "Resume"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View Reservations */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSelectedDay(null);
                router.push(`/dashboard?date=${selectedDay}`);
              }}
            >
              <Eye className="h-4 w-4" />
              View Reservations for This Day
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
