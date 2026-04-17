"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, Badge, Button, StatusDot, Modal, Input } from "@/components/ui";
import { formatPhone, formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Clock, Users, Phone, User, Plus, MessageSquare, MapPin, ChevronDown, ChevronUp, GripVertical, Pencil } from "lucide-react";

interface HostStandProps {
  locationId: string;
  date: string;
}

export function HostStand({ locationId, date }: HostStandProps) {
  const [draggingGuest, setDraggingGuest] = useState<{ id: string; type: "reservation" | "waitlist"; name: string; partySize: number } | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<{ id: string; type: "reservation" | "waitlist"; data: any } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showWaitlistAdd, setShowWaitlistAdd] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"upcoming" | "waitlist" | "seated" | "done" | null>("upcoming");
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", phone: "", email: "", date, time: "", partySize: 2, specialRequests: "" });
  const [waitlistForm, setWaitlistForm] = useState({ firstName: "", lastName: "", phone: "", partySize: 2 });
  const [createError, setCreateError] = useState("");
  const [editingRes, setEditingRes] = useState<any | null>(null);
  const [editResForm, setEditResForm] = useState({ date: "", time: "", partySize: 2, specialRequests: "" });
  const [editResError, setEditResError] = useState("");
  const [editingWait, setEditingWait] = useState<any | null>(null);
  const [editWaitForm, setEditWaitForm] = useState({ partySize: 2, estimatedWaitMinutes: 0 });
  const [editWaitError, setEditWaitError] = useState("");
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // Data queries
  const { data: reservations } = trpc.reservation.getByDate.useQuery({ locationId, date }, { refetchInterval: 8000 });
  const { data: waitlistEntries } = trpc.waitlist.getActive.useQuery({ locationId }, { refetchInterval: 8000 });
  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId }, { refetchInterval: 8000 });
  const { data: floorPlans } = trpc.table.getFloorPlans.useQuery({ locationId });
  const { data: slots } = trpc.reservation.getAvailability.useQuery({ locationId, date: createForm.date, partySize: createForm.partySize }, { enabled: showCreate });
  const { data: editSlots } = trpc.reservation.getAvailability.useQuery({ locationId, date: editResForm.date, partySize: editResForm.partySize }, { enabled: !!editingRes && !!editResForm.date });

  // Mutations
  const seatResMutation = trpc.reservation.seat.useMutation();
  const completeResMutation = trpc.reservation.complete.useMutation();
  const noShowMutation = trpc.reservation.markNoShow.useMutation();
  const undoNoShowMutation = trpc.reservation.undoNoShow.useMutation();
  const cancelResMutation = trpc.reservation.cancel.useMutation();
  const createResMutation = trpc.reservation.create.useMutation();
  const seatWaitlistMutation = trpc.waitlist.seat.useMutation();
  const notifyWaitlistMutation = trpc.waitlist.notify.useMutation();
  const removeWaitlistMutation = trpc.waitlist.remove.useMutation();
  const joinWaitlistMutation = trpc.waitlist.join.useMutation();
  const updateTableStatusMutation = trpc.table.updateStatus.useMutation();
  // For reassigning table on a seated reservation
  const updateResMutation = trpc.reservation.update.useMutation();
  const updateWaitlistMutation = trpc.waitlist.update.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.reservation.getByDate.invalidate({ locationId, date });
    utils.waitlist.getActive.invalidate({ locationId });
    utils.table.getByLocation.invalidate({ locationId });
  }

  // ── Drag and Drop ──
  function startDrag(id: string, type: "reservation" | "waitlist", name: string, partySize: number) {
    setDraggingGuest({ id, type, name, partySize });
  }

  function handleTableDrop(tableId: string) {
    if (!draggingGuest) return;
    if (draggingGuest.type === "reservation") {
      seatResMutation.mutateAsync({ reservationId: draggingGuest.id, tableId }).then(() => invalidate());
    } else {
      seatWaitlistMutation.mutateAsync({ entryId: draggingGuest.id, tableId }).then(() => invalidate());
    }
    setDraggingGuest(null);
  }

  function endDrag() {
    setDraggingGuest(null);
  }

  // ── Guest selection (click to assign) ──
  function selectGuest(id: string, type: "reservation" | "waitlist", data: any) {
    setSelectedGuest({ id, type, data });
  }

  async function assignTable(tableId: string) {
    if (!selectedGuest) return;
    if (selectedGuest.type === "reservation") {
      const isSeated = selectedGuest.data.status === "seated";
      if (isSeated) {
        // Reassign: free old table, seat at new
        if (selectedGuest.data.table_id) {
          await updateTableStatusMutation.mutateAsync({ tableId: selectedGuest.data.table_id, status: "turning" });
        }
        await updateResMutation.mutateAsync({ reservationId: selectedGuest.id, tableId });
        await updateTableStatusMutation.mutateAsync({ tableId, status: "occupied" });
      } else {
        await seatResMutation.mutateAsync({ reservationId: selectedGuest.id, tableId });
      }
    } else {
      await seatWaitlistMutation.mutateAsync({ entryId: selectedGuest.id, tableId });
    }
    setSelectedGuest(null);
    invalidate();
  }

  // ── Actions ──
  async function handleComplete(id: string) { await completeResMutation.mutateAsync({ reservationId: id }); invalidate(); }
  async function handleNoShow(id: string) { await noShowMutation.mutateAsync({ reservationId: id }); invalidate(); }
  async function handleUndoNoShow(id: string) { await undoNoShowMutation.mutateAsync({ reservationId: id }); invalidate(); }
  async function handleCancel(id: string) { await cancelResMutation.mutateAsync({ reservationId: id }); invalidate(); }
  async function handleNotifyWaitlist(id: string) { await notifyWaitlistMutation.mutateAsync({ entryId: id }); invalidate(); }
  async function handleRemoveWaitlist(id: string) { await removeWaitlistMutation.mutateAsync({ entryId: id }); invalidate(); }

  async function handleCreateRes() {
    setCreateError("");
    if (!createForm.time) { setCreateError("Select a time"); return; }
    try {
      await createResMutation.mutateAsync({ locationId, firstName: createForm.firstName, lastName: createForm.lastName || undefined, phone: createForm.phone, email: createForm.email || undefined, date: createForm.date, time: createForm.time, partySize: createForm.partySize, specialRequests: createForm.specialRequests || undefined, source: "staff" as const });
      setShowCreate(false);
      setCreateForm({ firstName: "", lastName: "", phone: "", email: "", date, time: "", partySize: 2, specialRequests: "" });
      invalidate();
    } catch (e: any) { setCreateError(e.message?.includes("SLOT") ? "Time slot full" : e.message?.includes("DUPLICATE") ? "Already has reservation" : "Failed"); }
  }

  function openEditRes(res: any) {
    setEditingRes(res);
    setEditResForm({
      date: res.date,
      time: (res.time || "").slice(0, 5),
      partySize: res.party_size,
      specialRequests: res.special_requests || "",
    });
    setEditResError("");
  }

  async function handleEditRes() {
    if (!editingRes) return;
    setEditResError("");
    const original = editingRes;
    const payload: any = { reservationId: original.id };
    if (editResForm.date !== original.date) payload.date = editResForm.date;
    if (editResForm.time !== (original.time || "").slice(0, 5)) payload.time = editResForm.time;
    if (editResForm.partySize !== original.party_size) payload.partySize = editResForm.partySize;
    if ((editResForm.specialRequests || "") !== (original.special_requests || "")) {
      payload.specialRequests = editResForm.specialRequests;
    }
    try {
      await updateResMutation.mutateAsync(payload);
      const newDate = editResForm.date;
      setEditingRes(null);
      invalidate();
      if (newDate !== date) utils.reservation.getByDate.invalidate({ locationId, date: newDate });
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("SLOT_UNAVAILABLE")) setEditResError("Time slot is full.");
      else if (msg.includes("CANNOT_MODIFY")) setEditResError("Reservation can no longer be modified.");
      else if (msg.includes("NOT_FOUND")) setEditResError("Reservation not found.");
      else setEditResError(msg || "Failed to update.");
    }
  }

  function openEditWait(entry: any) {
    setEditingWait(entry);
    setEditWaitForm({
      partySize: entry.party_size,
      estimatedWaitMinutes: entry.estimated_wait_minutes ?? 0,
    });
    setEditWaitError("");
  }

  async function handleEditWait() {
    if (!editingWait) return;
    setEditWaitError("");
    try {
      await updateWaitlistMutation.mutateAsync({
        entryId: editingWait.id,
        partySize: editWaitForm.partySize,
        estimatedWaitMinutes: editWaitForm.estimatedWaitMinutes,
      });
      setEditingWait(null);
      invalidate();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("CANNOT_MODIFY")) setEditWaitError("Entry can no longer be modified.");
      else if (msg.includes("NOT_FOUND")) setEditWaitError("Entry not found.");
      else setEditWaitError(msg || "Failed to update.");
    }
  }

  async function handleAddWaitlist() {
    try {
      await joinWaitlistMutation.mutateAsync({
        locationId,
        firstName: waitlistForm.firstName,
        lastName: waitlistForm.lastName || undefined,
        phone: waitlistForm.phone,
        partySize: waitlistForm.partySize,
        source: "staff" as const,
      });
      setShowWaitlistAdd(false);
      setWaitlistForm({ firstName: "", lastName: "", phone: "", partySize: 2 });
      invalidate();
    } catch {}
  }

  // ── Data grouping ──
  const upcoming = reservations?.filter((r: any) => r.status === "confirmed" || r.status === "reminded") || [];
  const seated = reservations?.filter((r: any) => r.status === "seated") || [];
  const done = reservations?.filter((r: any) => r.status === "completed" || r.status === "no_show" || r.status === "cancelled") || [];
  const waitlist = waitlistEntries || [];
  const availableTables = tables?.filter((t: any) => t.status === "available") || [];
  const floorPlan = floorPlans?.find((fp: any) => fp.active);
  const labels: any[] = floorPlan?.labels || [];
  const availableSlots = slots?.filter((s: any) => s.available) || [];

  const STATUS_STYLES: Record<string, string> = {
    available: "bg-status-available/15 border-status-available text-status-available",
    reserved: "bg-status-reserved/15 border-status-reserved text-status-reserved",
    occupied: "bg-status-occupied/15 border-status-occupied text-status-occupied",
    turning: "bg-status-turning/15 border-status-turning text-status-turning",
  };

  function getTableDims(capacity: number, shape: string, mult: number) {
    const base = (56 + Math.min(capacity - 1, 6) * 12) * (mult || 1);
    switch (shape) {
      case "circle": return { w: base, h: base, r: "9999px" };
      case "square": return { w: base, h: base, r: "12px" };
      case "rectangle": return { w: base * 1.6, h: base * 0.85, r: "12px" };
      default: return capacity <= 2 ? { w: base, h: base, r: "9999px" } : capacity <= 4 ? { w: base, h: base, r: "12px" } : { w: base * 1.4, h: base * 0.9, r: "16px" };
    }
  }

  // ── Guest row component ──
  function GuestRow({ id, type, data, name, phone: guestPhone, partySize, time, tags, specialReqs, status, tableLabel }: any) {
    const isSelected = selectedGuest?.id === id;
    const isSeated = status === "seated";
    return (
      <div
        draggable
        onDragStart={() => startDrag(id, type, name, partySize)}
        onDragEnd={endDrag}
        onClick={() => selectGuest(id, type, data)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (type === "reservation" && !isSeated && status !== "no_show" && status !== "cancelled" && status !== "completed") openEditRes(data);
          else if (type === "waitlist" && (data.status === "waiting" || data.status === "notified")) openEditWait(data);
        }}
        className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all text-sm ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-surface-alt/50"}`}
      >
        <GripVertical className="h-3.5 w-3.5 text-text-muted/40 shrink-0" />
        <StatusDot status={status} pulse={status === "notified" || isSeated} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/guests/${data?.guest?.id || data?.guest_id || ""}`} className="font-medium truncate hover:text-primary" onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
            {tags?.map((t: any) => <Badge key={t.id} variant={t.tag === "VIP" ? "primary" : "default"} className="text-[9px] px-1 py-0">{t.tag}</Badge>)}
            {tableLabel && <Badge variant="secondary" className="text-[9px] px-1 py-0"><MapPin className="h-2.5 w-2.5" />{tableLabel}</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {time && <span>{formatTime12h(time)}</span>}
            <span>{partySize}p</span>
            {guestPhone && <span className="hidden sm:inline">{formatPhone(guestPhone)}</span>}
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {type === "reservation" && !isSeated && status !== "no_show" && status !== "cancelled" && status !== "completed" && (
            <>
              <Button variant="secondary" size="sm" className="text-[11px] px-2 py-1 h-auto gap-1" onClick={(e) => { e.stopPropagation(); openEditRes(data); }} title="Edit reservation">
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleNoShow(id); }}>NS</Button>
              <Button variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleCancel(id); }}>X</Button>
            </>
          )}
          {type === "reservation" && isSeated && (
            <Button variant="accent" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleComplete(id); }}>Done</Button>
          )}
          {type === "reservation" && status === "no_show" && (
            <Button variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleUndoNoShow(id); }}>Undo</Button>
          )}
          {type === "waitlist" && (data.status === "waiting" || data.status === "notified") && (
            <Button variant="secondary" size="sm" className="text-[11px] px-2 py-1 h-auto gap-1" onClick={(e) => { e.stopPropagation(); openEditWait(data); }} title="Edit entry">
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
          {type === "waitlist" && data.status === "waiting" && (
            <Button variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleNotifyWaitlist(id); }}>Notify</Button>
          )}
          {type === "waitlist" && (
            <Button variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto" onClick={(e) => { e.stopPropagation(); handleRemoveWaitlist(id); }}>X</Button>
          )}
        </div>
      </div>
    );
  }

  // ── Section toggle ──
  function Section({ id, title, count, children, color }: { id: string; title: string; count: number; children: React.ReactNode; color?: string }) {
    const isOpen = expandedSection === id;
    return (
      <div>
        <button onClick={() => setExpandedSection(isOpen ? null : id as any)} className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text cursor-pointer">
          <span className="flex items-center gap-1.5">{title} <Badge variant={color as any || "default"} className="text-[9px]">{count}</Badge></span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {isOpen && <div className="space-y-1 pb-2">{children}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-120px)]">
        {/* LEFT: Guest lists */}
        <div className="w-[380px] shrink-0 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Guests</h2>
            <div className="flex gap-1">
              <Button size="sm" className="text-[10px] px-2 py-1 h-auto" onClick={() => { setCreateForm({ ...createForm, date }); setShowCreate(true); }}>
                <Plus className="h-3 w-3" /> Res
              </Button>
              <Button size="sm" variant="secondary" className="text-[10px] px-2 py-1 h-auto" onClick={() => setShowWaitlistAdd(true)}>
                <Plus className="h-3 w-3" /> Wait
              </Button>
            </div>
          </div>

          {/* Scrollable guest list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Upcoming reservations */}
            <Section id="upcoming" title="Upcoming" count={upcoming.length} color="secondary">
              {upcoming.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-3">No upcoming reservations</p>
              ) : (
                upcoming.map((r: any) => (
                  <GuestRow
                    key={r.id} id={r.id} type="reservation" data={r}
                    name={`${r.guest?.first_name || ""} ${r.guest?.last_name || ""}`}
                    phone={r.guest?.phone} partySize={r.party_size} time={r.time}
                    tags={r.guest?.tags} specialReqs={r.special_requests} status={r.status}
                  />
                ))
              )}
            </Section>

            {/* Waitlist */}
            <Section id="waitlist" title="Waitlist" count={waitlist.length} color="warning">
              {waitlist.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-3">No one waiting</p>
              ) : (
                waitlist.map((w: any) => (
                  <GuestRow
                    key={w.id} id={w.id} type="waitlist" data={w}
                    name={`${w.guest?.first_name || ""} ${w.guest?.last_name || ""}`}
                    phone={w.guest?.phone} partySize={w.party_size} time={null}
                    tags={w.guest?.tags} status={w.status}
                  />
                ))
              )}
            </Section>

            {/* Seated */}
            <Section id="seated" title="Seated" count={seated.length} color="primary">
              {seated.map((r: any) => (
                <GuestRow
                  key={r.id} id={r.id} type="reservation" data={r}
                  name={`${r.guest?.first_name || ""} ${r.guest?.last_name || ""}`}
                  phone={r.guest?.phone} partySize={r.party_size} time={r.time}
                  tags={r.guest?.tags} status={r.status} tableLabel={r.table?.label}
                />
              ))}
            </Section>

            {/* Done */}
            {done.length > 0 && (
              <Section id="done" title="Done" count={done.length}>
                {done.map((r: any) => (
                  <GuestRow
                    key={r.id} id={r.id} type="reservation" data={r}
                    name={`${r.guest?.first_name || ""} ${r.guest?.last_name || ""}`}
                    phone={r.guest?.phone} partySize={r.party_size} time={r.time}
                    tags={r.guest?.tags} status={r.status}
                  />
                ))}
              </Section>
            )}
          </div>

          {/* Footer summary */}
          <div className="p-2 border-t border-border text-xs text-text-muted flex justify-around">
            <span>{upcoming.length} upcoming</span>
            <span>{seated.length} seated</span>
            <span>{waitlist.length} waiting</span>
          </div>
        </div>

        {/* RIGHT: Floor Plan */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">Floor Plan</h2>
              <div className="hidden sm:flex items-center gap-2">
                <StatusDot status="available" label />
                <StatusDot status="occupied" label />
                <StatusDot status="turning" label />
              </div>
            </div>
            {draggingGuest && (
              <Badge variant="primary" className="animate-pulse">
                Drop {draggingGuest.name} ({draggingGuest.partySize}p) on a table
              </Badge>
            )}
            {selectedGuest && !draggingGuest && (
              <Badge variant="primary">
                Click a table to seat {selectedGuest.data?.guest?.first_name || "guest"}
              </Badge>
            )}
          </div>

          {/* Floor plan canvas */}
          <div
            ref={floorPlanRef}
            className="flex-1 relative bg-surface-alt/50 overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {}} // handled per-table
          >
            {/* Dot grid */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #2a2a2a 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

            {/* Labels */}
            {labels.map((lbl: any) => (
              <div key={lbl.id} className={`absolute text-[10px] font-semibold uppercase tracking-wider select-none ${lbl.id === "entrance" ? "bg-ditch-charcoal text-white px-3 py-1 rounded-md" : "text-text-muted/30"}`} style={{ left: `${lbl.x}%`, top: `${lbl.y}%` }}>
                {lbl.text}
              </div>
            ))}

            {/* Tables */}
            {tables?.map((table: any) => {
              const dims = getTableDims(table.capacity, table.shape || "auto", table.size_multiplier || 1);
              const style = STATUS_STYLES[table.status] || STATUS_STYLES.available;
              const canDrop = table.status === "available" && (draggingGuest || selectedGuest);
              const isDropTarget = canDrop && draggingGuest && table.capacity >= draggingGuest.partySize;

              // Find who's seated here
              const seatedHere = seated.find((r: any) => r.table_id === table.id);

              return (
                <div
                  key={table.id}
                  className={`absolute flex flex-col items-center justify-center border-2 transition-all ${style} ${canDrop ? "cursor-pointer hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-primary" : "cursor-default"} ${isDropTarget ? "ring-2 ring-primary scale-105 shadow-lg" : ""}`}
                  style={{ left: `${table.position_x}%`, top: `${table.position_y}%`, width: dims.w, height: dims.h, borderRadius: dims.r, transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined }}
                  onDragOver={(e) => { if (table.status === "available") e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (table.status === "available") handleTableDrop(table.id); }}
                  onClick={() => {
                    if (selectedGuest && table.status === "available") {
                      assignTable(table.id);
                    } else if (selectedGuest && selectedGuest.type === "reservation" && selectedGuest.data.status === "seated") {
                      // Reassign seated guest to this table
                      assignTable(table.id);
                    } else if (!selectedGuest && !draggingGuest) {
                      // Click empty table to cycle status
                      const cycle: Record<string, string> = { available: "available", turning: "available", occupied: "occupied", reserved: "reserved" };
                      if (table.status === "turning") {
                        updateTableStatusMutation.mutateAsync({ tableId: table.id, status: "available" }).then(() => invalidate());
                      }
                    }
                  }}
                >
                  <span className="font-bold text-[10px] leading-none">{table.label}</span>
                  <span className="text-[8px] opacity-70 leading-none mt-0.5">{table.capacity}p</span>
                  {seatedHere && (
                    <span className="text-[7px] font-medium leading-none mt-0.5 max-w-full truncate px-1">
                      {seatedHere.guest?.first_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Table count */}
          <div className="p-2 border-t border-border text-xs text-text-muted flex justify-around">
            <span>{availableTables.length} open</span>
            <span>{tables?.filter((t: any) => t.status === "occupied").length || 0} occupied</span>
            <span>{tables?.filter((t: any) => t.status === "turning").length || 0} turning</span>
          </div>
        </div>
      </div>

      {/* Create Reservation Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Reservation">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateRes(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input label="First Name" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} required />
            <Input label="Last Name" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} />
          </div>
          <Input label="Phone" type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="(555) 123-4567" required />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Date" type="date" value={createForm.date} min={format(new Date(), "yyyy-MM-dd")} max={format(addDays(new Date(), 30), "yyyy-MM-dd")} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value, time: "" })} required />
            <div>
              <label className="block text-sm font-medium text-text mb-1">Party</label>
              <div className="flex gap-1 flex-wrap">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <button key={n} type="button" onClick={() => setCreateForm({ ...createForm, partySize: n, time: "" })} className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${createForm.partySize === n ? "bg-primary text-white border-primary" : "bg-white border-border"}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Time</label>
            {availableSlots.length === 0 ? <p className="text-xs text-text-muted italic">No times available</p> : (
              <div className="grid grid-cols-4 gap-1">
                {availableSlots.map((s: any) => (
                  <button key={s.time} type="button" onClick={() => setCreateForm({ ...createForm, time: s.time })} className={`py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${createForm.time === s.time ? "bg-primary text-white border-primary" : "bg-white border-border"}`}>{formatTime12h(s.time)}</button>
                ))}
              </div>
            )}
          </div>
          {createError && <p className="text-xs text-status-error text-center">{createError}</p>}
          <Button type="submit" className="w-full" loading={createResMutation.isPending} disabled={!createForm.time}>Create Reservation</Button>
        </form>
      </Modal>

      {/* Add to Waitlist Modal */}
      <Modal open={showWaitlistAdd} onClose={() => setShowWaitlistAdd(false)} title="Add to Waitlist">
        <form onSubmit={(e) => { e.preventDefault(); handleAddWaitlist(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input label="First Name" value={waitlistForm.firstName} onChange={(e) => setWaitlistForm({ ...waitlistForm, firstName: e.target.value })} required />
            <Input label="Last Name" value={waitlistForm.lastName} onChange={(e) => setWaitlistForm({ ...waitlistForm, lastName: e.target.value })} />
          </div>
          <Input label="Phone" type="tel" value={waitlistForm.phone} onChange={(e) => setWaitlistForm({ ...waitlistForm, phone: e.target.value })} placeholder="(555) 123-4567" required />
          <div>
            <label className="block text-sm font-medium text-text mb-1">Party Size</label>
            <div className="flex gap-1 flex-wrap">
              {[1,2,3,4,5,6,7,8].map((n) => (
                <button key={n} type="button" onClick={() => setWaitlistForm({ ...waitlistForm, partySize: n })} className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${waitlistForm.partySize === n ? "bg-secondary text-white border-secondary" : "bg-white border-border"}`}>{n}</button>
              ))}
            </div>
          </div>
          <Button type="submit" variant="secondary" className="w-full" loading={joinWaitlistMutation.isPending}>Add to Waitlist</Button>
        </form>
      </Modal>

      {/* Edit Reservation Modal */}
      <Modal open={!!editingRes} onClose={() => setEditingRes(null)} title="Edit Reservation">
        <form onSubmit={(e) => { e.preventDefault(); handleEditRes(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Date" type="date" value={editResForm.date} min={format(new Date(), "yyyy-MM-dd")} max={format(addDays(new Date(), 30), "yyyy-MM-dd")} onChange={(e) => setEditResForm({ ...editResForm, date: e.target.value, time: "" })} required />
            <div>
              <label className="block text-sm font-medium text-text mb-1">Party</label>
              <div className="flex gap-1 flex-wrap">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <button key={n} type="button" onClick={() => setEditResForm({ ...editResForm, partySize: n, time: "" })} className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${editResForm.partySize === n ? "bg-primary text-white border-primary" : "bg-white border-border"}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Time</label>
            {(() => {
              const available = (editSlots || []).filter((s: any) => s.available);
              const current = editResForm.time;
              const hasCurrent = available.some((s: any) => s.time === current);
              const options = hasCurrent || !current ? available : [{ time: current, available: true }, ...available];
              if (options.length === 0) return <p className="text-xs text-text-muted italic">No times available</p>;
              return (
                <div className="grid grid-cols-4 gap-1">
                  {options.map((s: any) => (
                    <button key={s.time} type="button" onClick={() => setEditResForm({ ...editResForm, time: s.time })} className={`py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${editResForm.time === s.time ? "bg-primary text-white border-primary" : "bg-white border-border"}`}>{formatTime12h(s.time)}</button>
                  ))}
                </div>
              );
            })()}
          </div>
          <Input label="Special Requests" value={editResForm.specialRequests} onChange={(e) => setEditResForm({ ...editResForm, specialRequests: e.target.value })} placeholder="Allergies, celebrations, seating..." />
          {editResError && <p className="text-xs text-status-error text-center">{editResError}</p>}
          <Button type="submit" className="w-full" loading={updateResMutation.isPending} disabled={!editResForm.time}>Save Changes</Button>
        </form>
      </Modal>

      {/* Edit Waitlist Modal */}
      <Modal open={!!editingWait} onClose={() => setEditingWait(null)} title="Edit Waitlist Entry">
        <form onSubmit={(e) => { e.preventDefault(); handleEditWait(); }} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Party Size</label>
            <div className="flex gap-1 flex-wrap">
              {[1,2,3,4,5,6,7,8].map((n) => (
                <button key={n} type="button" onClick={() => setEditWaitForm({ ...editWaitForm, partySize: n })} className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${editWaitForm.partySize === n ? "bg-secondary text-white border-secondary" : "bg-white border-border"}`}>{n}</button>
              ))}
            </div>
          </div>
          <Input
            label="Estimated Wait (minutes)"
            type="number"
            min={0}
            max={600}
            value={editWaitForm.estimatedWaitMinutes}
            onChange={(e) => setEditWaitForm({ ...editWaitForm, estimatedWaitMinutes: parseInt(e.target.value) || 0 })}
          />
          {editWaitError && <p className="text-xs text-status-error text-center">{editWaitError}</p>}
          <Button type="submit" variant="secondary" className="w-full" loading={updateWaitlistMutation.isPending}>Save Changes</Button>
        </form>
      </Modal>
    </>
  );
}
