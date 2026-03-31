"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Modal,
  Badge,
} from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30; // start at 6:00 AM
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  return { value, label: formatTime12h(value) };
});

export default function SettingsPage() {
  const { locationId, locationName, isLoading: locLoading } = useLocation();
  const [showAdd, setShowAdd] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);

  const [form, setForm] = useState({
    name: "Dinner",
    dayOfWeek: 0,
    startTime: "17:00",
    endTime: "22:00",
    maxCovers: 60,
    slotDurationMin: 30,
  });

  const { data: shifts, isLoading } = trpc.table.getShifts.useQuery(
    { locationId },
    { enabled: !!locationId }
  );

  const createMutation = trpc.table.createShift.useMutation();
  const updateMutation = trpc.table.updateShift.useMutation();
  const deleteMutation = trpc.table.deleteShift.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.table.getShifts.invalidate({ locationId });
  }

  async function handleCreate() {
    await createMutation.mutateAsync({
      locationId,
      name: form.name,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      maxCovers: form.maxCovers,
      slotDurationMin: form.slotDurationMin,
    });
    setShowAdd(false);
    resetForm();
    invalidate();
  }

  async function handleUpdate() {
    if (!editingShift) return;
    await updateMutation.mutateAsync({
      shiftId: editingShift.id,
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      maxCovers: form.maxCovers,
      slotDurationMin: form.slotDurationMin,
      active: true,
    });
    setEditingShift(null);
    resetForm();
    invalidate();
  }

  async function handleDelete(shiftId: string) {
    await deleteMutation.mutateAsync({ shiftId });
    invalidate();
  }

  function resetForm() {
    setForm({
      name: "Dinner",
      dayOfWeek: 0,
      startTime: "17:00",
      endTime: "22:00",
      maxCovers: 60,
      slotDurationMin: 30,
    });
  }

  function openEdit(shift: any) {
    setForm({
      name: shift.name,
      dayOfWeek: shift.day_of_week,
      startTime: shift.start_time.slice(0, 5),
      endTime: shift.end_time.slice(0, 5),
      maxCovers: shift.max_covers,
      slotDurationMin: shift.slot_duration_min,
    });
    setEditingShift(shift);
  }

  // Group shifts by day
  const shiftsByDay = new Map<number, any[]>();
  for (let d = 0; d < 7; d++) shiftsByDay.set(d, []);
  shifts?.forEach((s: any) => {
    const day = shiftsByDay.get(s.day_of_week) || [];
    day.push(s);
    shiftsByDay.set(s.day_of_week, day);
  });

  if (locLoading || !locationId) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-sm text-text-muted">
          Manage service shifts for {locationName}
        </p>
      </div>

      {/* Service Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>Service Shifts</CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-4 w-4" />
            Add Shift
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(shiftsByDay.entries()).map(([day, dayShifts]) => (
              <div key={day}>
                <h4 className="text-sm font-semibold text-text-muted mb-2">
                  {DAY_NAMES[day]}
                </h4>
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-text-muted/60 italic pl-2 pb-2">
                    No shifts — restaurant closed
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift: any) => (
                      <div
                        key={shift.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {shift.name}
                            </span>
                            {!shift.active && (
                              <Badge variant="default">Disabled</Badge>
                            )}
                          </div>
                          <p className="text-xs text-text-muted">
                            {formatTime12h(shift.start_time)} –{" "}
                            {formatTime12h(shift.end_time)} · {shift.max_covers}{" "}
                            covers · {shift.slot_duration_min}min slots
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(shift)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(shift.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-status-error" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Shift Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Service Shift"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="space-y-4"
        >
          <Input
            label="Shift Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dinner, Brunch, Lunch"
            required
          />
          <Select
            label="Day of Week"
            value={form.dayOfWeek.toString()}
            onChange={(e) =>
              setForm({ ...form, dayOfWeek: parseInt(e.target.value) })
            }
            options={DAY_NAMES.map((name, i) => ({
              value: i.toString(),
              label: name,
            }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Start Time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              options={TIME_OPTIONS}
            />
            <Select
              label="End Time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              options={TIME_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Covers"
              type="number"
              min={1}
              value={form.maxCovers}
              onChange={(e) =>
                setForm({ ...form, maxCovers: parseInt(e.target.value) || 1 })
              }
              required
            />
            <Select
              label="Slot Duration"
              value={form.slotDurationMin.toString()}
              onChange={(e) =>
                setForm({
                  ...form,
                  slotDurationMin: parseInt(e.target.value),
                })
              }
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "45", label: "45 minutes" },
                { value: "60", label: "60 minutes" },
              ]}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={createMutation.isPending}
          >
            Add Shift
          </Button>
        </form>
      </Modal>

      {/* Edit Shift Modal */}
      <Modal
        open={!!editingShift}
        onClose={() => setEditingShift(null)}
        title={`Edit ${editingShift?.name || "Shift"} — ${DAY_NAMES[editingShift?.day_of_week] || ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdate();
          }}
          className="space-y-4"
        >
          <Input
            label="Shift Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Start Time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              options={TIME_OPTIONS}
            />
            <Select
              label="End Time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              options={TIME_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Covers"
              type="number"
              min={1}
              value={form.maxCovers}
              onChange={(e) =>
                setForm({ ...form, maxCovers: parseInt(e.target.value) || 1 })
              }
              required
            />
            <Select
              label="Slot Duration"
              value={form.slotDurationMin.toString()}
              onChange={(e) =>
                setForm({
                  ...form,
                  slotDurationMin: parseInt(e.target.value),
                })
              }
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "45", label: "45 minutes" },
                { value: "60", label: "60 minutes" },
              ]}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={updateMutation.isPending}
          >
            Save Changes
          </Button>
        </form>
      </Modal>
    </div>
  );
}
