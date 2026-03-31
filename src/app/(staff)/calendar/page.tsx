"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import { Card, Button, Badge, Modal, Input } from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Ban, Shield } from "lucide-react";
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
  const [manageDay, setManageDay] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data: summary } = trpc.reservation.getMonthSummary.useQuery(
    { locationId, year, month },
    { enabled: !!locationId }
  );

  const { data: shifts } = trpc.table.getShifts.useQuery(
    { locationId },
    { enabled: !!locationId && !!manageDay }
  );

  const blockMutation = trpc.table.blockDate.useMutation();
  const unblockMutation = trpc.table.unblockDate.useMutation();
  const toggleShiftMutation = trpc.table.toggleShiftActive.useMutation();
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
    await blockMutation.mutateAsync({ locationId, date: dateStr, reason: blockReason || undefined });
    setBlockReason("");
    invalidate();
  }

  async function handleUnblockDate(dateStr: string) {
    await unblockMutation.mutateAsync({ locationId, date: dateStr });
    invalidate();
  }

  async function handleToggleShift(shiftId: string, currentlyActive: boolean) {
    await toggleShiftMutation.mutateAsync({ shiftId, active: !currentlyActive });
    invalidate();
  }

  if (locLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  const firstDay = new Date(year, month - 1, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = format(now, "yyyy-MM-dd");

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const manageDayObj = manageDay ? new Date(manageDay + "T00:00:00") : null;
  const manageDow = manageDayObj?.getDay();
  const manageDayShifts = manageDow !== undefined
    ? (shifts || []).filter((s: any) => s.day_of_week === manageDow)
    : [];
  const manageIsBlocked = manageDay ? summary?.blockedDates?.[manageDay] !== undefined : false;
  const manageBlockReason = manageDay ? summary?.blockedDates?.[manageDay] : "";
  const manageDayData = manageDay ? summary?.reservations?.[manageDay] : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Calendar</h1>
          <p className="text-sm text-text-muted">Click a day to view reservations</p>
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

      <Card padding="sm">
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-text-muted py-2">{d}</div>
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
              <div
                key={i}
                className={`relative h-20 rounded-lg border p-1.5 transition-colors group ${
                  isBlocked
                    ? "bg-status-error/5 border-status-error/20"
                    : isToday
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface-alt"
                }`}
              >
                {/* Main clickable area — navigates to dashboard */}
                <button
                  className="absolute inset-0 w-full h-full cursor-pointer z-0"
                  onClick={() => router.push(`/dashboard?date=${dateStr}`)}
                />

                {/* Day number + manage button */}
                <div className="relative z-10 flex items-start justify-between pointer-events-none">
                  <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-text"}`}>
                    {day}
                  </span>
                  {/* Manage button — visible on hover or if blocked */}
                  <button
                    className={`pointer-events-auto cursor-pointer p-0.5 rounded transition-opacity ${
                      isBlocked
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setManageDay(dateStr);
                    }}
                    title="Manage availability"
                  >
                    {isBlocked ? (
                      <Ban className="h-3.5 w-3.5 text-status-error" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 text-text-muted hover:text-primary" />
                    )}
                  </button>
                </div>

                {/* Stats */}
                <div className="relative z-10 pointer-events-none">
                  {dayData && !isBlocked && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs font-medium text-text">{dayData.confirmed} res</p>
                      <p className="text-[10px] text-text-muted">{dayData.covers} covers</p>
                    </div>
                  )}
                  {isBlocked && (
                    <p className="text-[10px] text-status-error mt-1 font-medium">Blocked</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center gap-6 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-primary bg-primary/5" /> Today
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-border bg-white" /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-status-error/20 bg-status-error/5" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3" /> Hover for availability controls
        </span>
      </div>

      {/* Manage Day Modal */}
      <Modal
        open={!!manageDay}
        onClose={() => { setManageDay(null); setBlockReason(""); }}
        title={manageDay ? `Manage — ${format(new Date(manageDay + "T00:00:00"), "EEEE, MMMM d")}` : ""}
      >
        {manageDay && (
          <div className="space-y-5">
            {manageDayData && (
              <div className="bg-surface-alt rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Reservations</span>
                  <span className="font-medium">{manageDayData.confirmed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Covers</span>
                  <span className="font-medium">{manageDayData.covers}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Full Day</h3>
              {manageIsBlocked ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-status-error/20 bg-status-error/5">
                  <div>
                    <p className="text-sm font-medium text-status-error flex items-center gap-1.5">
                      <Ban className="h-4 w-4" /> Reservations Blocked
                    </p>
                    {manageBlockReason && (
                      <p className="text-xs text-text-muted mt-0.5">{manageBlockReason}</p>
                    )}
                  </div>
                  <Button variant="accent" size="sm" onClick={() => handleUnblockDate(manageDay)} loading={unblockMutation.isPending}>
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
                  <Button variant="danger" size="sm" className="w-full" onClick={() => handleBlockDate(manageDay)} loading={blockMutation.isPending}>
                    <Ban className="h-4 w-4" /> Block All Reservations
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Shifts — {manageDayObj ? DAY_NAMES[manageDayObj.getDay()] : ""}
              </h3>
              {manageDayShifts.length === 0 ? (
                <p className="text-xs text-text-muted italic">No shifts configured for this day.</p>
              ) : (
                <div className="space-y-2">
                  {manageDayShifts.map((shift: any) => (
                    <div
                      key={shift.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        shift.active ? "border-border" : "border-status-warning/30 bg-status-warning/5"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{shift.name}</span>
                          {!shift.active && <Badge variant="warning">Paused</Badge>}
                        </div>
                        <p className="text-xs text-text-muted">
                          {formatTime12h(shift.start_time)} – {formatTime12h(shift.end_time)} · {shift.max_covers} covers
                        </p>
                      </div>
                      <Button
                        variant={shift.active ? "ghost" : "accent"}
                        size="sm"
                        onClick={() => handleToggleShift(shift.id, shift.active)}
                        loading={toggleShiftMutation.isPending}
                      >
                        {shift.active ? (
                          <><Ban className="h-3.5 w-3.5" /> Pause</>
                        ) : (
                          "Resume"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
