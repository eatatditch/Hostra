"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import { FloorPlan } from "@/components/dashboard/floor-plan";
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
      <StaffManager />
      <LocationManager />
    </div>
  );
}

// ── Shift Manager ─────────────────────────────────────────

function ShiftManager({ locationId }: { locationId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [form, setForm] = useState({
    name: "Dinner",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6] as number[],
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
    setForm({ name: "Dinner", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "17:00", endTime: "22:00", maxCovers: 60, slotDurationMin: 30 });
  }

  async function handleCreate() {
    for (const dayOfWeek of form.daysOfWeek) {
      await createMutation.mutateAsync({
        locationId,
        name: form.name,
        dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        maxCovers: form.maxCovers,
        slotDurationMin: form.slotDurationMin,
      });
    }
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
      daysOfWeek: [shift.day_of_week],
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

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  function toggleDay(day: number) {
    const current: number[] = form.daysOfWeek;
    if (current.includes(day)) {
      setForm({ ...form, daysOfWeek: current.filter((d: number) => d !== day) });
    } else {
      setForm({ ...form, daysOfWeek: [...current, day].sort() });
    }
  }

  function selectAll() {
    setForm({ ...form, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  }

  function selectWeekdays() {
    setForm({ ...form, daysOfWeek: [1, 2, 3, 4, 5] });
  }

  function selectWeekends() {
    setForm({ ...form, daysOfWeek: [0, 6] });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Input label="Shift Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dinner, Brunch, Lunch" required />

      {showDayPicker && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text">Days</label>
          <div className="flex gap-1.5">
            {SHORT_DAYS.map((label, i) => {
              const selected = form.daysOfWeek.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selected
                      ? "bg-primary text-white border-primary"
                      : "bg-white border-border text-text hover:border-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline cursor-pointer">All</button>
            <button type="button" onClick={selectWeekdays} className="text-xs text-primary hover:underline cursor-pointer">Weekdays</button>
            <button type="button" onClick={selectWeekends} className="text-xs text-primary hover:underline cursor-pointer">Weekends</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Start Time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} options={TIME_OPTIONS} />
        <Select label="End Time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} options={TIME_OPTIONS} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Max Covers" type="number" min={1} value={form.maxCovers} onChange={(e) => setForm({ ...form, maxCovers: parseInt(e.target.value) || 1 })} required />
        <Select label="Slot Duration" value={form.slotDurationMin.toString()} onChange={(e) => setForm({ ...form, slotDurationMin: parseInt(e.target.value) })} options={[{ value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }, { value: "45", label: "45 minutes" }, { value: "60", label: "60 minutes" }]} />
      </div>
      <Button type="submit" className="w-full" loading={loading} disabled={showDayPicker && form.daysOfWeek.length === 0}>
        {submitLabel}
        {showDayPicker && form.daysOfWeek.length > 1 && (
          <span className="ml-1 text-xs opacity-80">({form.daysOfWeek.length} days)</span>
        )}
      </Button>
    </form>
  );
}

// ── Table Manager ─────────────────────────────────────────

function TableManager({ locationId }: { locationId: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-muted mb-2">Floor Plan & Tables</h3>
      <p className="text-xs text-text-muted mb-3">
        Click the unlock icon to drag tables around. Click + Table to add new ones.
      </p>
      <FloorPlan locationId={locationId} editable />
    </div>
  );
}

function _OldTableManager({ locationId }: { locationId: string }) {
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

// ── Staff Manager ─────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin — Full access" },
  { value: "manager", label: "Manager — Config + CRM + reports" },
  { value: "host", label: "Host — Dashboard + seating + notes" },
];

const ROLE_COLORS: Record<string, "primary" | "secondary" | "default"> = {
  admin: "primary",
  manager: "secondary",
  host: "default",
};

function StaffManager() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "host" as string,
    locationId: "",
  });

  const { data: staffList, isLoading } = trpc.staff.list.useQuery();
  const { data: locations } = trpc.table.getLocations.useQuery();
  const createMutation = trpc.staff.create.useMutation();
  const updateMutation = trpc.staff.update.useMutation();
  const resetPwMutation = trpc.staff.resetPassword.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.staff.list.invalidate();
  }

  function resetForm() {
    setForm({ email: "", password: "", name: "", role: "host", locationId: locations?.[0]?.id || "" });
    setError("");
  }

  async function handleCreate() {
    setError("");
    const locId = form.locationId || locations?.[0]?.id || "";
    if (!locId) {
      setError("No location available. Create a location first.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        email: form.email,
        password: form.password,
        name: form.name,
        role: form.role as "admin" | "manager" | "host",
        locationId: locId,
      });
      setShowAdd(false);
      resetForm();
      invalidate();
    } catch (e: any) {
      setError(e.message || "Failed to create staff account");
    }
  }

  async function handleUpdate() {
    if (!editingStaff) return;
    await updateMutation.mutateAsync({
      staffId: editingStaff.id,
      name: form.name,
      role: form.role as "admin" | "manager" | "host",
      locationId: form.locationId,
    });
    setEditingStaff(null);
    invalidate();
  }

  async function handleToggleActive(staffId: string, currentlyActive: boolean) {
    await updateMutation.mutateAsync({ staffId, active: !currentlyActive });
    invalidate();
  }

  async function handleResetPassword(staffId: string) {
    const newPw = prompt("Enter new password (min 8 characters):");
    if (!newPw || newPw.length < 8) return;
    await resetPwMutation.mutateAsync({ staffId, newPassword: newPw });
    alert("Password updated.");
  }

  function openEdit(s: any) {
    setForm({
      email: s.email,
      password: "",
      name: s.name,
      role: s.role,
      locationId: s.location_id,
    });
    setEditingStaff(s);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Staff Accounts</CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {staffList?.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <Badge variant={ROLE_COLORS[s.role] || "default"}>
                      {s.role}
                    </Badge>
                    {!s.active && <Badge variant="default">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-text-muted">
                    {s.email} · {s.location?.name || "No location"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleResetPassword(s.id)}>
                    Reset PW
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(s.id, s.active)}>
                    {s.active ? (
                      <Trash2 className="h-3.5 w-3.5 text-status-error" />
                    ) : (
                      <span className="text-xs text-status-success">Enable</span>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Staff Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="staff@eatatditch.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Min 8 characters"
            required
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
          />
          {locations && locations.length > 0 && (
            <Select
              label="Default Location"
              value={form.locationId || locations[0]?.id}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              options={locations.map((l: any) => ({ value: l.id, label: l.name }))}
            />
          )}
          <div className="bg-surface-alt rounded-lg p-3 text-xs text-text-muted space-y-1">
            <p><strong>Admin</strong> — Full access: locations, tables, shifts, staff, CRM, everything</p>
            <p><strong>Manager</strong> — Config shifts/tables, CRM, reports, seating. Cannot manage locations or staff.</p>
            <p><strong>Host</strong> — Dashboard, seating, waitlist, guest notes. Cannot edit settings.</p>
          </div>
          {error && (
            <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded">{error}</p>
          )}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Create Staff Account
          </Button>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={`Edit ${editingStaff?.name || "Staff"}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
          />
          {locations && locations.length > 0 && (
            <Select
              label="Default Location"
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              options={locations.map((l: any) => ({ value: l.id, label: l.name }))}
            />
          )}
          <Button type="submit" className="w-full" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </>
  );
}

// ── Location Manager ──────────────────────────────────────

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
];

function LocationManager() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
    timezone: "America/New_York",
  });

  const { data: locations, isLoading } = trpc.table.getLocations.useQuery();
  const createMutation = trpc.table.createLocation.useMutation();
  const updateMutation = trpc.table.updateLocation.useMutation();
  const deactivateMutation = trpc.table.deactivateLocation.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.table.getLocations.invalidate();
  }

  async function handleDeactivateLocation(locationId: string) {
    if (!confirm("Remove this location? It will no longer appear for guests or staff.")) return;
    await deactivateMutation.mutateAsync({ locationId });
    invalidate();
  }

  function resetForm() {
    setForm({ name: "", slug: "", address: "", phone: "", timezone: "America/New_York" });
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleCreate() {
    await createMutation.mutateAsync({
      name: form.name,
      slug: form.slug || generateSlug(form.name),
      address: form.address || undefined,
      phone: form.phone || undefined,
      timezone: form.timezone,
    });
    setShowAdd(false);
    resetForm();
    invalidate();
  }

  async function handleUpdate() {
    if (!editingLocation) return;
    await updateMutation.mutateAsync({
      locationId: editingLocation.id,
      name: form.name,
      address: form.address,
      phone: form.phone,
      timezone: form.timezone,
    });
    setEditingLocation(null);
    resetForm();
    invalidate();
  }

  function openEdit(loc: any) {
    setForm({
      name: loc.name,
      slug: loc.slug,
      address: loc.address || "",
      phone: loc.phone || "",
      timezone: loc.timezone || "America/New_York",
    });
    setEditingLocation(loc);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {locations?.map((loc: any) => (
              <div
                key={loc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="space-y-0.5">
                  <span className="font-medium text-sm">{loc.name}</span>
                  <p className="text-xs text-text-muted">
                    {loc.address || "No address"}
                    {loc.phone && ` · ${loc.phone}`}
                    {" · "}
                    {TIMEZONES.find((t) => t.value === loc.timezone)?.label || loc.timezone}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {(locations?.length || 0) > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivateLocation(loc.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-status-error" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Location Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Location">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Input
            label="Location Name"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) });
            }}
            placeholder="e.g. Ditch — Montauk"
            required
          />
          <Input
            label="URL Slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="e.g. montauk"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Main St, Town, NY"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(631) 555-0300"
          />
          <Select
            label="Timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            options={TIMEZONES}
          />
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Create Location
          </Button>
          <p className="text-xs text-text-muted text-center">
            A default floor plan will be created automatically.
          </p>
        </form>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        open={!!editingLocation}
        onClose={() => setEditingLocation(null)}
        title={`Edit ${editingLocation?.name || "Location"}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
          <Input
            label="Location Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="Timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            options={TIMEZONES}
          />
          <Button type="submit" className="w-full" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </>
  );
}
