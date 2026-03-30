"use client";

import { useState } from "react";
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
import { Plus, Bell, X } from "lucide-react";

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

  const { data: entries, isLoading } = trpc.waitlist.getActive.useQuery(
    { locationId },
    { refetchInterval: 10000 }
  );

  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId });

  const joinMutation = trpc.waitlist.join.useMutation();
  const notifyMutation = trpc.waitlist.notify.useMutation();
  const seatMutation = trpc.waitlist.seat.useMutation();
  const removeMutation = trpc.waitlist.remove.useMutation();
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

  const availableTables = tables?.filter((t) => t.status === "available") || [];

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
            {entries?.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between p-3 rounded-lg border border-border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-muted">
                      #{entry.position}
                    </span>
                    <StatusDot
                      status={entry.status}
                      pulse={entry.status === "notified"}
                    />
                    <span className="font-medium text-sm">
                      {entry.guest.firstName} {entry.guest.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>Party of {entry.partySize}</span>
                    {entry.estimatedWaitMinutes != null && (
                      <span>
                        ~{minutesToHumanReadable(entry.estimatedWaitMinutes)}
                      </span>
                    )}
                  </div>
                </div>
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
                        className="text-xs border border-border rounded px-1.5 py-1"
                        onChange={(e) => {
                          if (e.target.value) handleSeat(entry.id, e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Seat
                        </option>
                        {availableTables
                          .filter((t) => t.capacity >= entry.partySize)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </select>
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
    </>
  );
}
