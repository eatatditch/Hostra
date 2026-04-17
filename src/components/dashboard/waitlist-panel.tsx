"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  StatusDot,
  Modal,
  Input,
} from "@/components/ui";
import { formatPhone, minutesToHumanReadable } from "@/lib/utils";
import { Plus, Bell, X, User, Pencil } from "lucide-react";

interface WaitlistPanelProps {
  locationId: string;
}

export function WaitlistPanel({ locationId }: WaitlistPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    partySize: 2,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    partySize: 2,
    estimatedWaitMinutes: 0,
  });
  const [editError, setEditError] = useState("");

  const { data: entries, isLoading } = trpc.waitlist.getActive.useQuery(
    { locationId },
    { refetchInterval: 10000 }
  );

  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId });

  const joinMutation = trpc.waitlist.join.useMutation();
  const notifyMutation = trpc.waitlist.notify.useMutation();
  const seatMutation = trpc.waitlist.seat.useMutation();
  const removeMutation = trpc.waitlist.remove.useMutation();
  const updateMutation = trpc.waitlist.update.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.waitlist.getActive.invalidate({ locationId });
    utils.table.getByLocation.invalidate({ locationId });
  }

  async function handleJoin() {
    await joinMutation.mutateAsync({
      locationId,
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      phone: form.phone,
      partySize: form.partySize,
      source: "staff",
    });
    setForm({ firstName: "", lastName: "", phone: "", partySize: 2 });
    setShowAdd(false);
    invalidate();
  }

  async function handleNotify(entryId: string) {
    await notifyMutation.mutateAsync({ entryId });
    invalidate();
  }

  async function handleSeat(entryId: string, tableId: string) {
    await seatMutation.mutateAsync({ entryId, tableId });
    invalidate();
  }

  async function handleRemove(entryId: string) {
    await removeMutation.mutateAsync({ entryId });
    invalidate();
  }

  function openEdit(entry: any) {
    setEditingId(entry.id);
    setEditForm({
      partySize: entry.party_size,
      estimatedWaitMinutes: entry.estimated_wait_minutes ?? 0,
    });
    setEditError("");
  }

  async function handleEdit() {
    if (!editingId) return;
    setEditError("");
    try {
      await updateMutation.mutateAsync({
        entryId: editingId,
        partySize: editForm.partySize,
        estimatedWaitMinutes: editForm.estimatedWaitMinutes,
      });
      setEditingId(null);
      invalidate();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("CANNOT_MODIFY")) setEditError("This entry can no longer be modified.");
      else if (msg.includes("NOT_FOUND")) setEditError("Entry not found.");
      else setEditError("Failed to update waitlist entry. Please try again.");
    }
  }

  const availableTables = tables?.filter((t: any) => t.status === "available") || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            Waitlist
            <Badge variant="warning" className="ml-2">
              {entries?.length || 0}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
            ))}
          </div>
        ) : entries?.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            No one waiting
          </p>
        ) : (
          <div className="space-y-2">
            {entries?.map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-start justify-between p-3 rounded-lg border border-border"
              >
                <Link href={`/guests/${entry.guest?.id}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-muted">
                      #{entry.position}
                    </span>
                    <StatusDot
                      status={entry.status}
                      pulse={entry.status === "notified"}
                    />
                    <span className="font-medium text-sm">
                      {entry.guest?.first_name} {entry.guest?.last_name}
                    </span>
                    {entry.guest?.tags?.map((t: any) => (
                      <Badge
                        key={t.id}
                        variant={t.tag === "VIP" ? "primary" : "default"}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>Party of {entry.party_size}</span>
                    {entry.estimated_wait_minutes != null && (
                      <span>
                        ~{minutesToHumanReadable(entry.estimated_wait_minutes)}
                      </span>
                    )}
                    <span>{formatPhone(entry.guest?.phone || "")}</span>
                  </div>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  {entry.status === "waiting" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNotify(entry.id)}
                      title="Notify"
                    >
                      <Bell className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(entry.status === "waiting" || entry.status === "notified") &&
                    availableTables.length > 0 && (
                      <select
                        className="text-xs border border-border rounded px-1.5 py-1 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.value) handleSeat(entry.id, e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Seat
                        </option>
                        {availableTables
                          .filter((t: any) => t.capacity >= entry.party_size)
                          .map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.label} ({t.capacity})
                            </option>
                          ))}
                      </select>
                    )}
                  {(entry.status === "waiting" || entry.status === "notified") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(entry)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(entry.id)}
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add to Waitlist">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <Input
            label="Party Size"
            type="number"
            min={1}
            max={20}
            value={form.partySize}
            onChange={(e) =>
              setForm({ ...form, partySize: parseInt(e.target.value) || 1 })
            }
            required
          />
          <Button type="submit" loading={joinMutation.isPending} className="w-full">
            Add to Waitlist
          </Button>
        </form>
      </Modal>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Edit Waitlist Entry">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
          className="space-y-4"
        >
          <Input
            label="Party Size"
            type="number"
            min={1}
            max={20}
            value={editForm.partySize}
            onChange={(e) =>
              setEditForm({ ...editForm, partySize: parseInt(e.target.value) || 1 })
            }
            required
          />
          <Input
            label="Estimated Wait (minutes)"
            type="number"
            min={0}
            max={600}
            value={editForm.estimatedWaitMinutes}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                estimatedWaitMinutes: parseInt(e.target.value) || 0,
              })
            }
          />

          {editError && (
            <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded">
              {editError}
            </p>
          )}

          <Button type="submit" loading={updateMutation.isPending} className="w-full">
            Save Changes
          </Button>
        </form>
      </Modal>
    </>
  );
}
