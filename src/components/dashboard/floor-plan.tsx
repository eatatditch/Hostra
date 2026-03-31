"use client";

import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, StatusDot, Button, Modal, Input, Select } from "@/components/ui";
import { Plus, Lock, Unlock, Trash2, RotateCw } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-status-available/15 border-status-available text-status-available",
  reserved: "bg-status-reserved/15 border-status-reserved text-status-reserved",
  occupied: "bg-status-occupied/15 border-status-occupied text-status-occupied",
  turning: "bg-status-turning/15 border-status-turning text-status-turning",
};

type TableShape = "auto" | "circle" | "square" | "rectangle";

const SHAPE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "rectangle", label: "Rect" },
];

const GRID_SNAP = 5;
function snap(v: number) { return Math.round(v / GRID_SNAP) * GRID_SNAP; }

function getTableDims(capacity: number, shape: TableShape, mult: number) {
  const base = (56 + Math.min(capacity - 1, 6) * 12) * mult;
  switch (shape) {
    case "circle": return { w: base, h: base, r: "9999px" };
    case "square": return { w: base, h: base, r: "12px" };
    case "rectangle": return { w: base * 1.6, h: base * 0.85, r: "12px" };
    default:
      if (capacity <= 2) return { w: base, h: base, r: "9999px" };
      if (capacity <= 4) return { w: base, h: base, r: "12px" };
      return { w: base * 1.4, h: base * 0.9, r: "16px" };
  }
}

interface FloorPlanProps {
  locationId: string;
  editable?: boolean;
}

export function FloorPlan({ locationId, editable = false }: FloorPlanProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(!editable);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [newTable, setNewTable] = useState({ label: "", capacity: 4, minCapacity: 1, shape: "auto" as string, rotation: 0, sizeMultiplier: 1 });
  const [editForm, setEditForm] = useState({ label: "", capacity: 4, minCapacity: 1, shape: "auto" as string, rotation: 0, sizeMultiplier: 1 });
  const [labelForm, setLabelForm] = useState({ text: "" });
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newLabelText, setNewLabelText] = useState("");

  const { data: tables, isLoading } = trpc.table.getByLocation.useQuery({ locationId }, { refetchInterval: editable ? undefined : 10000 });
  const { data: floorPlans } = trpc.table.getFloorPlans.useQuery({ locationId }, { enabled: !!locationId });

  const updateMutation = trpc.table.update.useMutation();
  const updateStatusMutation = trpc.table.updateStatus.useMutation();
  const createMutation = trpc.table.create.useMutation();
  const updateLabelsMutation = trpc.table.updateFloorPlanLabels.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.table.getByLocation.invalidate({ locationId });
    utils.table.getFloorPlans.invalidate({ locationId });
  }

  const floorPlan = floorPlans?.find((fp: any) => fp.active);
  const labels: any[] = floorPlan?.labels || [];

  // ── Table drag ──
  const handlePointerDown = useCallback((e: React.PointerEvent, tableId: string) => {
    if (locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const table = tables?.find((t: any) => t.id === tableId);
    if (!table) return;
    setDragOffset({ x: e.clientX - rect.left - (table.position_x / 100) * rect.width, y: e.clientY - rect.top - (table.position_y / 100) * rect.height });
    setDragging(tableId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [locked, tables]);

  // ── Label drag ──
  const handleLabelPointerDown = useCallback((e: React.PointerEvent, labelId: string) => {
    if (locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lbl = labels.find((l: any) => l.id === labelId);
    if (!lbl) return;
    setDragOffset({ x: e.clientX - rect.left - (lbl.x / 100) * rect.width, y: e.clientY - rect.top - (lbl.y / 100) * rect.height });
    setDraggingLabel(labelId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [locked, labels]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (dragging) {
      let x = snap(Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)));
      let y = snap(Math.max(0, Math.min(90, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)));
      const el = document.getElementById(`table-${dragging}`);
      if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
    }
    if (draggingLabel) {
      let x = snap(Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)));
      let y = snap(Math.max(0, Math.min(95, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)));
      const el = document.getElementById(`label-${draggingLabel}`);
      if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
    }
  }, [dragging, draggingLabel, dragOffset]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (dragging) {
      let x = snap(Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)));
      let y = snap(Math.max(0, Math.min(90, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)));
      await updateMutation.mutateAsync({ tableId: dragging, positionX: x, positionY: y });
      setDragging(null);
      invalidate();
    }
    if (draggingLabel && floorPlan) {
      let x = snap(Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100)));
      let y = snap(Math.max(0, Math.min(95, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100)));
      const updated = labels.map((l: any) => l.id === draggingLabel ? { ...l, x, y } : l);
      await updateLabelsMutation.mutateAsync({ floorPlanId: floorPlan.id, labels: updated });
      setDraggingLabel(null);
      invalidate();
    }
  }, [dragging, draggingLabel, dragOffset, updateMutation, updateLabelsMutation, floorPlan, labels]);

  function handleTableClick(table: any) {
    if (dragging) return;
    if (editable && locked) {
      setEditForm({ label: table.label, capacity: table.capacity, minCapacity: table.min_capacity, shape: table.shape || "auto", rotation: table.rotation || 0, sizeMultiplier: table.size_multiplier || 1 });
      setEditingTable(table);
      return;
    }
    if (!editable) {
      const cycle: Record<string, string> = { available: "reserved", reserved: "occupied", occupied: "turning", turning: "available" };
      updateStatusMutation.mutateAsync({ tableId: table.id, status: (cycle[table.status] || "available") as any }).then(() => invalidate());
    }
  }

  function handleLabelClick(label: any) {
    if (draggingLabel || !editable || !locked) return;
    setLabelForm({ text: label.text });
    setEditingLabel(label);
  }

  async function handleEditSave() {
    if (!editingTable) return;
    await updateMutation.mutateAsync({ tableId: editingTable.id, label: editForm.label, capacity: editForm.capacity, minCapacity: editForm.minCapacity, shape: editForm.shape as any, rotation: editForm.rotation, sizeMultiplier: editForm.sizeMultiplier });
    setEditingTable(null);
    invalidate();
  }

  async function handleRemoveTable() {
    if (!editingTable) return;
    await updateMutation.mutateAsync({ tableId: editingTable.id, active: false });
    setEditingTable(null);
    invalidate();
  }

  async function handleCreateTable() {
    const fpId = floorPlans?.filter((fp: any) => fp.active)?.[0]?.id;
    if (!fpId) return;
    await createMutation.mutateAsync({ locationId, floorPlanId: fpId, label: newTable.label, capacity: newTable.capacity, minCapacity: newTable.minCapacity, positionX: 45, positionY: 45, shape: newTable.shape as any, rotation: newTable.rotation, sizeMultiplier: newTable.sizeMultiplier });
    setShowAddTable(false);
    setNewTable({ label: "", capacity: 4, minCapacity: 1, shape: "auto", rotation: 0, sizeMultiplier: 1 });
    invalidate();
  }

  async function handleLabelSave() {
    if (!editingLabel || !floorPlan) return;
    const updated = labels.map((l: any) => l.id === editingLabel.id ? { ...l, text: labelForm.text } : l);
    await updateLabelsMutation.mutateAsync({ floorPlanId: floorPlan.id, labels: updated });
    setEditingLabel(null);
    invalidate();
  }

  async function handleLabelDelete() {
    if (!editingLabel || !floorPlan) return;
    const updated = labels.filter((l: any) => l.id !== editingLabel.id);
    await updateLabelsMutation.mutateAsync({ floorPlanId: floorPlan.id, labels: updated });
    setEditingLabel(null);
    invalidate();
  }

  async function handleAddLabel() {
    if (!newLabelText.trim() || !floorPlan) return;
    const id = `label-${Date.now()}`;
    const updated = [...labels, { id, text: newLabelText.trim(), x: 45, y: 45 }];
    await updateLabelsMutation.mutateAsync({ floorPlanId: floorPlan.id, labels: updated });
    setShowAddLabel(false);
    setNewLabelText("");
    invalidate();
  }

  const gridLines = editable && !locked ? Array.from({ length: 21 }, (_, i) => i * GRID_SNAP) : [];

  return (
    <>
      <Card padding="none">
        <div className="p-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Floor Plan</h3>
            <div className="hidden sm:flex items-center gap-2">
              <StatusDot status="available" label />
              <StatusDot status="occupied" label />
              <StatusDot status="reserved" label />
              <StatusDot status="turning" label />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <>
                <Button variant={locked ? "ghost" : "primary"} size="sm" onClick={() => setLocked(!locked)}>
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  <span className="text-xs">{locked ? "Edit" : "Dragging"}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddLabel(true)}>
                  <Plus className="h-3.5 w-3.5" /> Label
                </Button>
                <Button size="sm" onClick={() => setShowAddTable(true)}>
                  <Plus className="h-4 w-4" /> Table
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          ref={canvasRef}
          className="relative bg-surface-alt/50 overflow-hidden select-none"
          style={{ height: editable ? 550 : 400 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Grid */}
          {gridLines.map((pos) => (
            <div key={`g-${pos}`}>
              <div className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${pos}%` }} />
              <div className="absolute left-0 right-0 border-t border-border/20" style={{ top: `${pos}%` }} />
            </div>
          ))}
          {(locked || !editable) && (
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #2a2a2a 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          )}

          {/* Labels */}
          {labels.map((lbl: any) => (
            <div
              key={lbl.id}
              id={`label-${lbl.id}`}
              className={cn(
                "absolute text-[10px] font-semibold uppercase tracking-wider select-none",
                lbl.id === "entrance"
                  ? "bg-ditch-charcoal text-white px-3 py-1 rounded-md"
                  : "text-text-muted/30",
                !locked && editable && "cursor-grab active:cursor-grabbing ring-1 ring-primary/30 rounded px-1",
                editable && locked && "cursor-pointer hover:text-text-muted/60"
              )}
              style={{ left: `${lbl.x}%`, top: `${lbl.y}%` }}
              onPointerDown={(e) => handleLabelPointerDown(e, lbl.id)}
              onClick={() => handleLabelClick(lbl)}
            >
              {lbl.text}
            </div>
          ))}

          {/* Tables */}
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            tables?.map((table: any) => {
              const dims = getTableDims(table.capacity, table.shape || "auto", table.size_multiplier || 1);
              const style = STATUS_STYLES[table.status] || STATUS_STYLES.available;
              return (
                <div
                  key={table.id}
                  id={`table-${table.id}`}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow",
                    style,
                    !locked && editable ? "cursor-grab active:cursor-grabbing ring-2 ring-primary/30" : editable && locked ? "cursor-pointer hover:ring-2 hover:ring-primary/50" : "cursor-pointer",
                    dragging === table.id && "shadow-lg scale-110 z-10 ring-2 ring-primary",
                    "hover:shadow-md hover:z-10"
                  )}
                  style={{ left: `${table.position_x}%`, top: `${table.position_y}%`, width: dims.w, height: dims.h, borderRadius: dims.r, transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined }}
                  onPointerDown={(e) => handlePointerDown(e, table.id)}
                  onClick={() => handleTableClick(table)}
                >
                  <span className="font-bold text-xs leading-none">{table.label}</span>
                  <span className="text-[9px] opacity-70 leading-none mt-0.5">{table.capacity}p</span>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-border text-xs text-text-muted text-center">
          {tables?.length || 0} tables · {tables?.reduce((s: number, t: any) => s + t.capacity, 0) || 0} seats
          {editable && !locked && " · Drag tables & labels to reposition"}
          {editable && locked && " · Click table to edit, click label to rename/remove"}
          {!editable && " · Click to cycle status"}
        </div>
      </Card>

      {/* Add Table Modal */}
      <Modal open={showAddTable} onClose={() => setShowAddTable(false)} title="Add Table">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTable(); }} className="space-y-4">
          <Input label="Label" value={newTable.label} onChange={(e) => setNewTable({ ...newTable, label: e.target.value })} placeholder="e.g. T9, B3" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Seats" type="number" min={1} max={20} value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 1 })} required />
            <Input label="Min Seats" type="number" min={1} max={20} value={newTable.minCapacity} onChange={(e) => setNewTable({ ...newTable, minCapacity: parseInt(e.target.value) || 1 })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Shape</label>
            <div className="flex gap-2">{SHAPE_OPTIONS.map((o) => (<button key={o.value} type="button" onClick={() => setNewTable({ ...newTable, shape: o.value })} className={cn("flex-1 py-2 rounded-lg border text-xs font-medium cursor-pointer text-center", newTable.shape === o.value ? "bg-primary text-white border-primary" : "bg-white border-border hover:border-primary")}>{o.label}</button>))}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Size: {newTable.sizeMultiplier.toFixed(1)}x</label>
            <input type="range" min={0.5} max={2.5} step={0.1} value={newTable.sizeMultiplier} onChange={(e) => setNewTable({ ...newTable, sizeMultiplier: parseFloat(e.target.value) })} className="w-full" />
          </div>
          <Button type="submit" className="w-full" loading={createMutation.isPending}>Add Table</Button>
        </form>
      </Modal>

      {/* Edit Table Modal */}
      <Modal open={!!editingTable} onClose={() => setEditingTable(null)} title={`Edit ${editingTable?.label || ""}`}>
        <form onSubmit={(e) => { e.preventDefault(); handleEditSave(); }} className="space-y-4">
          <Input label="Label" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Seats" type="number" min={1} max={20} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 1 })} required />
            <Input label="Min Seats" type="number" min={1} max={20} value={editForm.minCapacity} onChange={(e) => setEditForm({ ...editForm, minCapacity: parseInt(e.target.value) || 1 })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Shape</label>
            <div className="flex gap-2">{SHAPE_OPTIONS.map((o) => (<button key={o.value} type="button" onClick={() => setEditForm({ ...editForm, shape: o.value })} className={cn("flex-1 py-2 rounded-lg border text-xs font-medium cursor-pointer text-center", editForm.shape === o.value ? "bg-primary text-white border-primary" : "bg-white border-border hover:border-primary")}>{o.label}</button>))}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Size: {editForm.sizeMultiplier.toFixed(1)}x</label>
            <input type="range" min={0.5} max={2.5} step={0.1} value={editForm.sizeMultiplier} onChange={(e) => setEditForm({ ...editForm, sizeMultiplier: parseFloat(e.target.value) })} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Rotation: {editForm.rotation}°</label>
            <input type="range" min={0} max={359} step={15} value={editForm.rotation} onChange={(e) => setEditForm({ ...editForm, rotation: parseInt(e.target.value) })} className="w-full" />
            <div className="flex gap-1 mt-1">
              {[0, 45, 90, 135, 180, 270].map((d) => (<button key={d} type="button" onClick={() => setEditForm({ ...editForm, rotation: d })} className={cn("px-2 py-0.5 rounded text-xs border cursor-pointer", editForm.rotation === d ? "bg-primary text-white border-primary" : "border-border hover:border-primary")}>{d}°</button>))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={updateMutation.isPending}>Save</Button>
            <Button type="button" variant="danger" onClick={handleRemoveTable}><Trash2 className="h-4 w-4" /> Remove</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Label Modal */}
      <Modal open={!!editingLabel} onClose={() => setEditingLabel(null)} title="Edit Label">
        <form onSubmit={(e) => { e.preventDefault(); handleLabelSave(); }} className="space-y-4">
          <Input label="Label Text" value={labelForm.text} onChange={(e) => setLabelForm({ text: e.target.value })} required />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={updateLabelsMutation.isPending}>Save</Button>
            <Button type="button" variant="danger" onClick={handleLabelDelete}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </form>
      </Modal>

      {/* Add Label Modal */}
      <Modal open={showAddLabel} onClose={() => setShowAddLabel(false)} title="Add Label">
        <form onSubmit={(e) => { e.preventDefault(); handleAddLabel(); }} className="space-y-4">
          <Input label="Label Text" value={newLabelText} onChange={(e) => setNewLabelText(e.target.value)} placeholder="e.g. VIP Section, Bar, Window" required />
          <p className="text-xs text-text-muted">Label will appear in the center. Unlock and drag to position it.</p>
          <Button type="submit" className="w-full" loading={updateLabelsMutation.isPending}>Add Label</Button>
        </form>
      </Modal>
    </>
  );
}
