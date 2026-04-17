"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, Badge, Button, StatusDot, Modal, Input, Select } from "@/components/ui";
import { formatPhone, formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Clock, Users, MapPin, MessageSquare, Phone, User, Plus, Pencil } from "lucide-react";

interface ReservationListProps {
  locationId: string;
  date: string;
}

export function ReservationList({ locationId, date }: ReservationListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    date: date,
    time: "",
    partySize: 2,
    specialRequests: "",
  });
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    time: "",
    partySize: 2,
    specialRequests: "",
  });
  const [editError, setEditError] = useState("");

  const { data: reservations, isLoading } = trpc.reservation.getByDate.useQuery(
    { locationId, date },
    { refetchInterval: 10000 }
  );

  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId });

  const { data: slots } = trpc.reservation.getAvailability.useQuery(
    { locationId, date: form.date, partySize: form.partySize },
    { enabled: showCreate && !!form.date }
  );

  const { data: editSlots } = trpc.reservation.getAvailability.useQuery(
    { locationId, date: editForm.date, partySize: editForm.partySize },
    { enabled: !!editingId && !!editForm.date }
  );

  const seatMutation = trpc.reservation.seat.useMutation();
  const completeMutation = trpc.reservation.complete.useMutation();
  const noShowMutation = trpc.reservation.markNoShow.useMutation();
  const undoNoShowMutation = trpc.reservation.undoNoShow.useMutation();
  const cancelMutation = trpc.reservation.cancel.useMutation();
  const createMutation = trpc.reservation.create.useMutation();
  const updateMutation = trpc.reservation.update.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.reservation.getByDate.invalidate({ locationId, date });
    utils.table.getByLocation.invalidate({ locationId });
  }

  async function handleSeat(reservationId: string, tableId: string) { await seatMutation.mutateAsync({ reservationId, tableId }); invalidate(); }
  async function handleComplete(reservationId: string) { await completeMutation.mutateAsync({ reservationId }); invalidate(); }
  async function handleNoShow(reservationId: string) { await noShowMutation.mutateAsync({ reservationId }); invalidate(); }
  async function handleUndoNoShow(reservationId: string) { await undoNoShowMutation.mutateAsync({ reservationId }); invalidate(); }
  async function handleCancel(reservationId: string) { await cancelMutation.mutateAsync({ reservationId }); invalidate(); }

  function openCreate() {
    setForm({ firstName: "", lastName: "", phone: "", email: "", date, time: "", partySize: 2, specialRequests: "" });
    setCreateError("");
    setShowCreate(true);
  }

  function openEdit(res: any) {
    setEditingId(res.id);
    setEditForm({
      date: res.date,
      time: (res.time || "").slice(0, 5),
      partySize: res.party_size,
      specialRequests: res.special_requests || "",
    });
    setEditError("");
  }

  async function handleEdit() {
    if (!editingId) return;
    setEditError("");
    const original = reservations?.find((r: any) => r.id === editingId);
    const payload: any = { reservationId: editingId };
    if (original) {
      if (editForm.date !== original.date) payload.date = editForm.date;
      if (editForm.time !== (original.time || "").slice(0, 5)) payload.time = editForm.time;
      if (editForm.partySize !== original.party_size) payload.partySize = editForm.partySize;
      if ((editForm.specialRequests || "") !== (original.special_requests || "")) {
        payload.specialRequests = editForm.specialRequests;
      }
    } else {
      payload.date = editForm.date;
      payload.time = editForm.time;
      payload.partySize = editForm.partySize;
      payload.specialRequests = editForm.specialRequests;
    }
    try {
      await updateMutation.mutateAsync(payload);
      const newDate = editForm.date;
      setEditingId(null);
      invalidate();
      if (newDate !== date) {
        utils.reservation.getByDate.invalidate({ locationId, date: newDate });
      }
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("SLOT_UNAVAILABLE")) setEditError("This time slot is full.");
      else if (msg.includes("CANNOT_MODIFY")) setEditError("This reservation can no longer be modified.");
      else if (msg.includes("NOT_FOUND")) setEditError("Reservation not found.");
      else setEditError(msg || "Failed to update reservation. Please try again.");
    }
  }

  async function handleCreate() {
    setCreateError("");
    if (!form.time) { setCreateError("Please select a time"); return; }
    try {
      await createMutation.mutateAsync({
        locationId,
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        phone: form.phone,
        email: form.email || undefined,
        date: form.date,
        time: form.time,
        partySize: form.partySize,
        specialRequests: form.specialRequests || undefined,
        source: "staff" as const,
      });
      setShowCreate(false);
      invalidate();
      // Also invalidate the new date if different from current view
      if (form.date !== date) {
        utils.reservation.getByDate.invalidate({ locationId, date: form.date });
      }
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("SLOT_UNAVAILABLE")) setCreateError("This time slot is full.");
      else if (msg.includes("DUPLICATE")) setCreateError("Guest already has a reservation for this date.");
      else setCreateError("Failed to create reservation. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  const availableTables = tables?.filter((t: any) => t.status === "available") || [];
  const availableSlots = slots?.filter((s) => s.available) || [];

  const statusGroups = {
    upcoming: reservations?.filter((r: any) => r.status === "confirmed" || r.status === "reminded") || [],
    seated: reservations?.filter((r: any) => r.status === "seated") || [],
    completed: reservations?.filter((r: any) => r.status === "completed" || r.status === "no_show" || r.status === "cancelled") || [],
  };

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  return (
    <>
      <div className="space-y-4">
        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle>
              Upcoming
              <Badge variant="secondary" className="ml-2">
                {statusGroups.upcoming.length}
              </Badge>
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Reservation
            </Button>
          </CardHeader>
          {statusGroups.upcoming.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No upcoming reservations
            </p>
          ) : (
            <div className="space-y-2">
              {statusGroups.upcoming.map((res: any) => (
                <div key={res.id} className="p-3 rounded-lg border border-border hover:bg-surface-alt/50 transition-colors">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(res)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(res); } }}
                    className="block space-y-1 mb-2 cursor-pointer"
                    title="Edit reservation"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={res.status} />
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <Link
                        href={`/guests/${res.guest?.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold hover:underline"
                      >
                        {res.guest?.first_name} {res.guest?.last_name}
                      </Link>
                      {res.guest?.tags?.map((t: any) => (
                        <Badge key={t.id} variant={t.tag === "VIP" ? "primary" : "default"}>{t.tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-muted pl-9">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime12h(res.time)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{res.party_size}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(res.guest?.phone || "")}</span>
                    </div>
                    {res.special_requests && (
                      <p className="text-xs text-text-muted flex items-center gap-1 pl-9">
                        <MessageSquare className="h-3 w-3" />{res.special_requests}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    {availableTables.length > 0 ? (
                      <select
                        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white cursor-pointer"
                        onChange={(e) => { if (e.target.value) handleSeat(res.id, e.target.value); }}
                        defaultValue=""
                      >
                        <option value="" disabled>Seat at table...</option>
                        {availableTables.filter((t: any) => t.capacity >= res.party_size).map((t: any) => (
                          <option key={t.id} value={t.id}>{t.label} (seats {t.capacity})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-text-muted italic">No tables available</span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(res)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleNoShow(res.id)}>No-Show</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCancel(res.id)}>Cancel</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Currently Seated */}
        {statusGroups.seated.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Seated<Badge variant="primary" className="ml-2">{statusGroups.seated.length}</Badge></CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {statusGroups.seated.map((res: any) => (
                <div key={res.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <Link href={`/guests/${res.guest?.id}`} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusDot status="seated" pulse />
                      <span className="font-semibold">{res.guest?.first_name} {res.guest?.last_name}</span>
                      {res.table && (<Badge variant="secondary"><MapPin className="h-3 w-3" />{res.table.label}</Badge>)}
                      {res.guest?.tags?.map((t: any) => (<Badge key={t.id} variant={t.tag === "VIP" ? "primary" : "default"}>{t.tag}</Badge>))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <span>Party of {res.party_size}</span>
                      <span>{formatPhone(res.guest?.phone || "")}</span>
                      <span>{formatTime12h(res.time)}</span>
                    </div>
                  </Link>
                  <Button variant="accent" size="sm" onClick={() => handleComplete(res.id)}>Complete</Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Done */}
        {statusGroups.completed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Done<Badge className="ml-2">{statusGroups.completed.length}</Badge></CardTitle>
            </CardHeader>
            <div className="space-y-1">
              {statusGroups.completed.map((res: any) => (
                <div key={res.id} className="flex items-center justify-between p-2 rounded text-sm text-text-muted hover:bg-surface-alt/50 transition-colors">
                  <Link href={`/guests/${res.guest?.id}`} className="flex items-center gap-2">
                    <StatusDot status={res.status} />
                    <span>{res.guest?.first_name} {res.guest?.last_name}</span>
                    <span>{formatTime12h(res.time)}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{res.status.replace("_", " ")}</span>
                    {res.status === "no_show" && (
                      <Button variant="ghost" size="sm" onClick={() => handleUndoNoShow(res.id)} loading={undoNoShowMutation.isPending}>Undo</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Create Reservation Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Reservation">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" required />
          <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.date} min={minDate} max={maxDate} onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })} required />
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Party Size</label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, partySize: n, time: "" })}
                    className={`w-9 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${form.partySize === n ? "bg-primary text-white border-primary" : "bg-white border-border text-text hover:border-primary"}`}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Time slot picker */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Time</label>
            {availableSlots.length === 0 ? (
              <p className="text-xs text-text-muted italic py-2">No available times for this date and party size.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {availableSlots.map((slot) => (
                  <button key={slot.time} type="button" onClick={() => setForm({ ...form, time: slot.time })}
                    className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${form.time === slot.time ? "bg-primary text-white border-primary" : "bg-white border-border text-text hover:border-primary"}`}
                  >{formatTime12h(slot.time)}</button>
                ))}
              </div>
            )}
          </div>

          <Input label="Special Requests (optional)" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} placeholder="Allergies, celebrations, seating..." />

          {createError && (
            <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded">{createError}</p>
          )}

          <Button type="submit" className="w-full" loading={createMutation.isPending} disabled={!form.time}>
            Create Reservation
          </Button>
        </form>
      </Modal>

      {/* Edit Reservation Modal */}
      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Edit Reservation">
        <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={editForm.date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value, time: "" })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Party Size</label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, partySize: n, time: "" })}
                    className={`w-9 h-9 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${editForm.partySize === n ? "bg-primary text-white border-primary" : "bg-white border-border text-text hover:border-primary"}`}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Time</label>
            {(() => {
              const available = editSlots?.filter((s) => s.available) || [];
              const currentTime = editForm.time;
              const hasCurrent = available.some((s) => s.time === currentTime);
              const options = hasCurrent || !currentTime
                ? available
                : [{ time: currentTime, available: true }, ...available];
              if (options.length === 0) {
                return <p className="text-xs text-text-muted italic py-2">No available times for this date and party size.</p>;
              }
              return (
                <div className="grid grid-cols-4 gap-1.5">
                  {options.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, time: slot.time })}
                      className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${editForm.time === slot.time ? "bg-primary text-white border-primary" : "bg-white border-border text-text hover:border-primary"}`}
                    >{formatTime12h(slot.time)}</button>
                  ))}
                </div>
              );
            })()}
          </div>

          <Input
            label="Special Requests (optional)"
            value={editForm.specialRequests}
            onChange={(e) => setEditForm({ ...editForm, specialRequests: e.target.value })}
            placeholder="Allergies, celebrations, seating..."
          />

          {editError && (
            <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded">{editError}</p>
          )}

          <Button type="submit" className="w-full" loading={updateMutation.isPending} disabled={!editForm.time}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </>
  );
}
