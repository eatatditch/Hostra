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
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  return { value, label: formatTime12h(value) };
});

export default function SettingsPage() {
  const { locationId, locationName, isLoading: locLoading } = useLocation();

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
          Manage {locationName}
        </p>
      </div>

      <ShiftManager locationId={locationId} />
      <TableManager locationId={locationId} />
    </div>
  );
}

// ── Shift Manager ─────────────────────────────────────────

function ShiftManager({ locationId }: { locationId: string }) {
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

  function resetForm() {
    setForm({ name: "Dinner", dayOfWeek: 0, startTime: "17:00", endTime: "22:00", maxCovers: 60, slotDurationMin: 30 });
  }

  async function handleCreate() {
    await createMutation.mutateAsync({ locationId, ...form });
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

  const shiftsByDay = new Map<number, any[]>();
  for (let d = 0; d < 7; d++) shiftsByDay.set(d, []);
  shifts?.forEach((s: any) => {
    const day = shiftsByDay.get(s.day_of_week) || [];
    day.push(s);
    shiftsByDay.set(s.day_of_week, day);
  });

  return (
    <>
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
                  <p className="text-xs text-text-muted/60 italic pl-2 pb-2">No shifts — closed</p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift: any) => (
                      <div key={shift.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{shift.name}</span>
                            {!shift.active && <Badge variant="default">Disabled</Badge>}
                          </div>
                          <p className="text-xs text-text-muted">
                            {formatTime12h(shift.start_time)} – {formatTime12h(shift.end_time)} · {shift.max_covers} covers · {shift.slot_duration_min}min slots
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(shift)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(shift.id)}>
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
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Service Shift">
        <ShiftForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          loading={createMutation.isPending}
          submitLabel="Add Shift"
          showDayPicker
        />
      </Modal>

      {/* Edit Shift Modal */}
      <Modal
        open={!!editingShift}
        onClose={() => setEditingShift(null)}
        title={`Edit ${editingShift?.name || "Shift"} — ${DAY_NAMES[editingShift?.day_of_week] || ""}`}
      >
        <ShiftForm
          form={form}
          setForm={setForm}
          onSubmit={handleUpdate}
          loading={updateMutation.isPending}
          submitLabel="Save Changes"
        />
      </Modal>
    </>
  );
}

function ShiftForm({
  form, setForm, onSubmit, loading, submitLabel, showDayPicker,
}: {
  form: any;
  setForm: (f: any) => void;
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
  showDayPicker?: boolean;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Input label="Shift Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dinner, Brunch, Lunch" required />
      {showDayPicker && (
        <Select label="Day of Week" value={form.dayOfWeek.toString()} onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })} options={DAY_NAMES.map((name, i) => ({ value: i.toString(), label: name }))} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Start Time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} options={TIME_OPTIONS} />
        <Select label="End Time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} options={TIME_OPTIONS} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Max Covers" type="number" min={1} value={form.maxCovers} onChange={(e) => setForm({ ...form, maxCovers: parseInt(e.target.value) || 1 })} required />
        <Select label="Slot Duration" value={form.slotDurationMin.toString()} onChange={(e) => setForm({ ...form, slotDurationMin: parseInt(e.target.value) })} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "45", label: "45 minutes" }, { value: "60", label: "60 minutes" }]} />
      </div>
      <Button type="submit" className="w-full" loading={loading}>{submitLabel}</Button>
    </form>
  );
}

// ── Table Manager ─────────────────────────────────────────

function TableManager({ locationId }: { locationId: string }) {
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [tableForm, setTableForm] = useState({
    label: "",
    capacity: 4,
    minCapacity: 1,
    combinable: false,
  });

  const { data: floorPlans, isLoading } = trpc.table.getFloorPlans.useQuery(
    { locationId },
    { enabled: !!locationId }
  );

  const { data: tables } = trpc.table.getByLocation.useQuery(
    { locationId },
    { enabled: !!locationId }
  );

  const createTableMutation = trpc.table.create.useMutation();
  const updateTableMutation = trpc.table.update.useMutation();
  const createFloorPlanMutation = trpc.table.createFloorPlan.useMutation();
  const utils = trpc.useUtils();

  const [newFloorPlanName, setNewFloorPlanName] = useState("");
  const [showAddFloorPlan, setShowAddFloorPlan] = useState(false);

  function invalidate() {
    utils.table.getFloorPlans.invalidate({ locationId });
    utils.table.getByLocation.invalidate({ locationId });
  }

  function resetTableForm() {
    setTableForm({ label: "", capacity: 4, minCapacity: 1, combinable: false });
  }

  // Use the first active floor plan as default
  const defaultFloorPlanId = floorPlans?.[0]?.id || "";

  async function handleCreateTable() {
    if (!defaultFloorPlanId) return;
    await createTableMutation.mutateAsync({
      locationId,
      floorPlanId: defaultFloorPlanId,
      label: tableForm.label,
      capacity: tableForm.capacity,
      minCapacity: tableForm.minCapacity,
      combinable: tableForm.combinable,
    });
    setShowAddTable(false);
    resetTableForm();
    invalidate();
  }

  async function handleUpdateTable() {
    if (!editingTable) return;
    await updateTableMutation.mutateAsync({
      tableId: editingTable.id,
      label: tableForm.label,
      capacity: tableForm.capacity,
      minCapacity: tableForm.minCapacity,
      combinable: tableForm.combinable,
    });
    setEditingTable(null);
    resetTableForm();
    invalidate();
  }

  async function handleDeactivateTable(tableId: string) {
    await updateTableMutation.mutateAsync({ tableId, active: false });
    invalidate();
  }

  async function handleReactivateTable(tableId: string) {
    await updateTableMutation.mutateAsync({ tableId, active: true });
    invalidate();
  }

  async function handleCreateFloorPlan() {
    if (!newFloorPlanName.trim()) return;
    await createFloorPlanMutation.mutateAsync({
      locationId,
      name: newFloorPlanName.trim(),
    });
    setShowAddFloorPlan(false);
    setNewFloorPlanName("");
    invalidate();
  }

  function openEditTable(table: any) {
    setTableForm({
      label: table.label,
      capacity: table.capacity,
      minCapacity: table.min_capacity,
      combinable: table.combinable,
    });
    setEditingTable(table);
  }

  // Get all tables including inactive for management
  const allTables = floorPlans?.flatMap((fp: any) => fp.tables || []) || [];
  const activeTables = allTables.filter((t: any) => t.active);
  const inactiveTables = allTables.filter((t: any) => !t.active);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Floor Plan & Tables</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowAddFloorPlan(true)}>
              <Plus className="h-4 w-4" />
              Floor Plan
            </Button>
            <Button size="sm" onClick={() => { resetTableForm(); setShowAddTable(true); }} disabled={!defaultFloorPlanId}>
              <Plus className="h-4 w-4" />
              Add Table
            </Button>
          </div>
        </CardHeader>

        {/* Floor Plans */}
        {floorPlans && floorPlans.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-text-muted mb-2">Floor Plans</h4>
            <div className="flex flex-wrap gap-2">
              {floorPlans.map((fp: any) => (
                <Badge key={fp.id} variant="secondary">{fp.name}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Active Tables */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-text-muted mb-2">
            Active Tables ({activeTables.length})
          </h4>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-surface-alt rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activeTables.length === 0 ? (
            <p className="text-sm text-text-muted py-2">No tables configured yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeTables.map((table: any) => (
                <div
                  key={table.id}
                  className="p-3 rounded-lg border border-border bg-white space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{table.label}</span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => openEditTable(table)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeactivateTable(table.id)}>
                        <Trash2 className="h-3 w-3 text-status-error" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    {table.min_capacity}–{table.capacity} seats
                    {table.combinable && " · Combinable"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive Tables */}
        {inactiveTables.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-text-muted mb-2">
              Removed Tables ({inactiveTables.length})
            </h4>
            <div className="space-y-1">
              {inactiveTables.map((table: any) => (
                <div key={table.id} className="flex items-center justify-between p-2 rounded border border-dashed border-border text-sm text-text-muted">
                  <span>{table.label} ({table.capacity} seats)</span>
                  <Button variant="ghost" size="sm" onClick={() => handleReactivateTable(table.id)}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add Table Modal */}
      <Modal open={showAddTable} onClose={() => setShowAddTable(false)} title="Add Table">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTable(); }} className="space-y-4">
          <Input
            label="Table Label"
            value={tableForm.label}
            onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
            placeholder="e.g. T1, B2, P3"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Capacity"
              type="number"
              min={1}
              max={50}
              value={tableForm.capacity}
              onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 1 })}
              required
            />
            <Input
              label="Min Capacity"
              type="number"
              min={1}
              max={50}
              value={tableForm.minCapacity}
              onChange={(e) => setTableForm({ ...tableForm, minCapacity: parseInt(e.target.value) || 1 })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={tableForm.combinable}
              onChange={(e) => setTableForm({ ...tableForm, combinable: e.target.checked })}
              className="rounded"
            />
            Combinable with other tables
          </label>
          <Button type="submit" className="w-full" loading={createTableMutation.isPending}>
            Add Table
          </Button>
        </form>
      </Modal>

      {/* Edit Table Modal */}
      <Modal
        open={!!editingTable}
        onClose={() => setEditingTable(null)}
        title={`Edit Table ${editingTable?.label || ""}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateTable(); }} className="space-y-4">
          <Input
            label="Table Label"
            value={tableForm.label}
            onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Capacity"
              type="number"
              min={1}
              max={50}
              value={tableForm.capacity}
              onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 1 })}
              required
            />
            <Input
              label="Min Capacity"
              type="number"
              min={1}
              max={50}
              value={tableForm.minCapacity}
              onChange={(e) => setTableForm({ ...tableForm, minCapacity: parseInt(e.target.value) || 1 })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={tableForm.combinable}
              onChange={(e) => setTableForm({ ...tableForm, combinable: e.target.checked })}
              className="rounded"
            />
            Combinable with other tables
          </label>
          <Button type="submit" className="w-full" loading={updateTableMutation.isPending}>
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Add Floor Plan Modal */}
      <Modal open={showAddFloorPlan} onClose={() => setShowAddFloorPlan(false)} title="Add Floor Plan">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateFloorPlan(); }} className="space-y-4">
          <Input
            label="Floor Plan Name"
            value={newFloorPlanName}
            onChange={(e) => setNewFloorPlanName(e.target.value)}
            placeholder="e.g. Main Floor, Patio, Upstairs"
            required
          />
          <Button type="submit" className="w-full" loading={createFloorPlanMutation.isPending}>
            Create Floor Plan
          </Button>
        </form>
      </Modal>
    </>
  );
}
