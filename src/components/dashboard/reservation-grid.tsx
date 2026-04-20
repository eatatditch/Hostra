"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatTime12h } from "@/lib/utils";

interface ReservationGridProps {
  locationId: string;
  date: string;
}

// Defaults for the visible time window when a location has no shifts on the
// selected weekday. 10:00 → 23:00 at 15-min resolution covers most services.
const DEFAULT_START_MIN = 10 * 60;
const DEFAULT_END_MIN = 23 * 60;
const SLOT_MIN = 15;
const COL_W = 32; // px per 15-min slot
const ROW_H = 48; // px per table row
const LABEL_W = 96; // px sticky left column
const DEFAULT_DURATION_MIN = 90; // visual block length per reservation

const UNASSIGNED_ROW_ID = "__unassigned__";

function toMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(":");
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Reservations that shouldn't clutter the timeline.
function isVisibleStatus(status: string): boolean {
  return status !== "cancelled" && status !== "no_show" && status !== "completed";
}

const STATUS_BLOCK_STYLES: Record<string, string> = {
  confirmed: "bg-status-reserved/20 border-status-reserved text-status-reserved",
  reminded: "bg-status-reserved/20 border-status-reserved text-status-reserved",
  pending_deposit: "bg-status-warning/20 border-status-warning text-status-warning",
  seated: "bg-status-occupied/20 border-status-occupied text-status-occupied",
};

export function ReservationGrid({ locationId, date }: ReservationGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ tableId: string; time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId }, { refetchInterval: 15000 });
  const { data: reservations } = trpc.reservation.getByDate.useQuery({ locationId, date }, { refetchInterval: 15000 });
  const { data: shifts } = trpc.table.getShifts.useQuery({ locationId });

  const updateRes = trpc.reservation.update.useMutation();
  const utils = trpc.useUtils();

  // Compute visible time window from active shifts for the selected weekday.
  const { startMin, endMin, slotCount } = useMemo(() => {
    const dow = new Date(date + "T00:00:00").getDay();
    const todayShifts = (shifts || []).filter(
      (s: any) => s.day_of_week === dow && s.active
    );
    let start = DEFAULT_START_MIN;
    let end = DEFAULT_END_MIN;
    if (todayShifts.length > 0) {
      start = Math.min(...todayShifts.map((s: any) => toMinutes(s.start_time)));
      end = Math.max(...todayShifts.map((s: any) => toMinutes(s.end_time)));
    }
    // Round to nearest slot boundary
    start = Math.floor(start / SLOT_MIN) * SLOT_MIN;
    end = Math.ceil(end / SLOT_MIN) * SLOT_MIN;
    const count = Math.max(1, Math.floor((end - start) / SLOT_MIN));
    return { startMin: start, endMin: end, slotCount: count };
  }, [date, shifts]);

  const slotTimes = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < slotCount; i++) {
      arr.push(minutesToHHMM(startMin + i * SLOT_MIN));
    }
    return arr;
  }, [slotCount, startMin]);

  const visible = useMemo(
    () => (reservations || []).filter((r: any) => isVisibleStatus(r.status)),
    [reservations]
  );

  // Group reservations by row. Tables without an assignment land in the
  // "Unassigned" row at the top.
  const byRow = useMemo(() => {
    const map = new Map<string, any[]>();
    map.set(UNASSIGNED_ROW_ID, []);
    for (const t of tables || []) map.set(t.id, []);
    for (const r of visible) {
      const rowId = r.table_id || UNASSIGNED_ROW_ID;
      if (!map.has(rowId)) map.set(rowId, []);
      map.get(rowId)!.push(r);
    }
    return map;
  }, [tables, visible]);

  const rows = useMemo(() => {
    const list: { id: string; label: string; capacity: number | null }[] = [
      { id: UNASSIGNED_ROW_ID, label: "Unassigned", capacity: null },
    ];
    for (const t of tables || []) {
      list.push({ id: t.id, label: t.label, capacity: t.capacity });
    }
    return list;
  }, [tables]);

  const gridWidth = LABEL_W + slotCount * COL_W;

  function invalidate() {
    utils.reservation.getByDate.invalidate({ locationId, date });
    utils.table.getByLocation.invalidate({ locationId });
  }

  function leftForTime(time: string | null | undefined): number {
    const m = toMinutes((time || "").slice(0, 5));
    const offset = Math.max(0, m - startMin);
    return (offset / SLOT_MIN) * COL_W;
  }

  async function handleDrop(tableId: string, time: string) {
    if (!dragId) return;
    const reservation = visible.find((r: any) => r.id === dragId);
    if (!reservation) return;

    const currentTime = (reservation.time || "").slice(0, 5);
    const currentTableId = reservation.table_id || null;
    const targetTable = tableId === UNASSIGNED_ROW_ID ? null : tableId;
    const timeChanged = currentTime !== time;
    const tableChanged = currentTableId !== targetTable;

    if (!timeChanged && !tableChanged) {
      setDragId(null);
      setDragOver(null);
      return;
    }

    setError(null);
    try {
      const payload: any = { reservationId: dragId };
      if (timeChanged) payload.time = time;
      if (tableChanged) payload.tableId = targetTable;
      await updateRes.mutateAsync(payload);
      invalidate();
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("SLOT_UNAVAILABLE")) setError("That slot is full.");
      else if (msg.includes("CANNOT_MODIFY")) setError("Reservation can no longer be modified.");
      else setError(msg || "Failed to move reservation.");
    } finally {
      setDragId(null);
      setDragOver(null);
    }
  }

  if (!tables || !reservations) {
    return <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />;
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
      {/* Legend / error bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border text-xs">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border border-status-reserved bg-status-reserved/20" />
            Confirmed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border border-status-occupied bg-status-occupied/20" />
            Seated
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border border-status-warning bg-status-warning/20" />
            Pending deposit
          </span>
          <span className="hidden md:inline text-text-muted/80">
            Drag a reservation to a cell to reassign time or table.
          </span>
        </div>
        {error && <span className="text-status-error">{error}</span>}
      </div>

      {/* Grid scroller */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: gridWidth }} className="relative">
          {/* Header row */}
          <div
            className="sticky top-0 z-20 flex bg-white border-b border-border"
            style={{ height: 36 }}
          >
            <div
              className="sticky left-0 z-30 bg-white border-r border-border flex items-center justify-center text-[11px] font-semibold text-text-muted"
              style={{ width: LABEL_W, minWidth: LABEL_W }}
            >
              Tables
            </div>
            {slotTimes.map((t, i) => {
              const showLabel = i % 4 === 0; // hourly marks
              return (
                <div
                  key={t}
                  className={`text-[10px] text-text-muted flex items-end justify-start border-r ${
                    i % 4 === 0 ? "border-border" : "border-border/30"
                  }`}
                  style={{ width: COL_W, minWidth: COL_W, paddingBottom: 4, paddingLeft: 2 }}
                >
                  {showLabel ? formatTime12h(t).replace(":00", "") : ""}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rows.map((row) => {
            const rowReservations = byRow.get(row.id) || [];
            return (
              <div
                key={row.id}
                className="relative flex border-b border-border"
                style={{ height: ROW_H }}
              >
                {/* Sticky label column */}
                <div
                  className="sticky left-0 z-10 bg-white border-r border-border flex flex-col items-start justify-center px-2 text-xs"
                  style={{ width: LABEL_W, minWidth: LABEL_W }}
                >
                  <span className="font-semibold truncate w-full">{row.label}</span>
                  {row.capacity != null && (
                    <span className="text-[10px] text-text-muted">{row.capacity} seats</span>
                  )}
                </div>

                {/* Cells */}
                {slotTimes.map((t, i) => {
                  const isHovered =
                    dragOver?.tableId === row.id && dragOver.time === t;
                  return (
                    <div
                      key={t}
                      data-table-id={row.id}
                      data-time={t}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        if (dragOver?.tableId !== row.id || dragOver.time !== t) {
                          setDragOver({ tableId: row.id, time: t });
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(row.id, t);
                      }}
                      className={`border-r ${
                        i % 4 === 0 ? "border-border" : "border-border/30"
                      } ${isHovered ? "bg-primary/10" : "hover:bg-surface-alt/40"}`}
                      style={{ width: COL_W, minWidth: COL_W, height: ROW_H }}
                    />
                  );
                })}

                {/* Reservation blocks overlay */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: LABEL_W, right: 0 }}
                >
                  {rowReservations.map((r: any) => {
                    const style = STATUS_BLOCK_STYLES[r.status] || STATUS_BLOCK_STYLES.confirmed;
                    const left = leftForTime(r.time);
                    const widthSlots = Math.max(1, Math.floor(DEFAULT_DURATION_MIN / SLOT_MIN));
                    const width = widthSlots * COL_W - 2;
                    const startTime = (r.time || "").slice(0, 5);
                    const guestName = `${r.guest?.first_name || ""} ${r.guest?.last_name || ""}`.trim();
                    const isDragging = dragId === r.id;
                    return (
                      <div
                        key={r.id}
                        draggable
                        onDragStart={() => setDragId(r.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        className={`pointer-events-auto absolute rounded-md border px-2 py-1 text-[11px] leading-tight cursor-grab active:cursor-grabbing overflow-hidden ${style} ${
                          isDragging ? "opacity-50" : ""
                        }`}
                        style={{
                          left,
                          width,
                          top: 4,
                          height: ROW_H - 8,
                        }}
                        title={`${guestName} · ${r.party_size}p · ${formatTime12h(startTime)}`}
                      >
                        <Link
                          href={`/guests/${r.guest?.id || ""}`}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          draggable={false}
                          className="font-semibold truncate block hover:underline"
                        >
                          {guestName || "Guest"}
                        </Link>
                        <div className="flex items-center gap-1 text-[10px] opacity-80">
                          <span>{formatTime12h(startTime)}</span>
                          <span>·</span>
                          <span>{r.party_size}p</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {rows.length === 1 && (
            <div className="p-6 text-center text-sm text-text-muted">
              No tables configured yet. Add tables on the Tables page to see rows here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
