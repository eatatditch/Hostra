"use client";

import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, StatusDot, Button, Modal, Input } from "@/components/ui";
import { Plus, Lock, Unlock, Pencil, Trash2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-status-available/15 border-status-available text-status-available",
  reserved: "bg-status-reserved/15 border-status-reserved text-status-reserved",
  occupied: "bg-status-occupied/15 border-status-occupied text-status-occupied",
  turning: "bg-status-turning/15 border-status-turning text-status-turning",
};

const GRID_SNAP = 5; // snap to 5% increments

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

function getTableSize(capacity: number) {
  return 56 + Math.min(capacity - 1, 6) * 12;
}

function getTableShape(capacity: number): string {
  if (capacity <= 2) return "rounded-full";
  if (capacity <= 4) return "rounded-xl";
  return "rounded-2xl";
}

interface FloorPlanProps {
  locationId: string;
  editable?: boolean;
}

export function FloorPlan({ locationId, editable = false }: FloorPlanProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(!editable);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [newTable, setNewTable] = useState({ label: "", capacity: 4, minCapacity: 1 });
  const [editForm, setEditForm] = useState({ label: "", capacity: 4, minCapacity: 1 });

  const { data: tables, isLoading } = trpc.table.getByLocation.useQuery(
    { locationId },
    { refetchInterval: editable ? undefined : 10000 }
  );

  const { data: floorPlans } = trpc.table.getFloorPlans.useQuery(
    { locationId },
    { enabled: editable }
  );

  const updateMutation = trpc.table.update.useMutation();
  const updateStatusMutation = trpc.table.updateStatus.useMutation();
  const createMutation = trpc.table.create.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.table.getByLocation.invalidate({ locationId });
    utils.table.getFloorPlans.invalidate({ locationId });
  }

  // ── Drag handlers ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, tableId: string) => {
      if (locked) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const table = tables?.find((t: any) => t.id === tableId);
      if (!table) return;

      const tableX = (table.position_x / 100) * rect.width;
      const tableY = (table.position_y / 100) * rect.height;

      setDragOffset({
        x: e.clientX - rect.left - tableX,
        y: e.clientY - rect.top - tableY,
      });
      setDragging(tableId);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [locked, tables]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      let y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      x = snapToGrid(Math.max(0, Math.min(90, x)));
      y = snapToGrid(Math.max(0, Math.min(90, y)));

      const tableEl = document.getElementById(`table-${dragging}`);
      if (tableEl) {
        tableEl.style.left = `${x}%`;
        tableEl.style.top = `${y}%`;
      }
    },
    [dragging, dragOffset]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      let y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      x = snapToGrid(Math.max(0, Math.min(90, x)));
      y = snapToGrid(Math.max(0, Math.min(90, y)));

      await updateMutation.mutateAsync({
        tableId: dragging,
        positionX: x,
        positionY: y,
      });
      setDragging(null);
      invalidate();
    },
    [dragging, dragOffset, updateMutation]
  );

  // ── Click handlers ──

  function handleTableClick(table: any) {
    if (dragging) return;

    if (editable && locked) {
      // Edit mode but locked = open edit modal
      setEditForm({
        label: table.label,
        capacity: table.capacity,
        minCapacity: table.min_capacity,
      });
      setEditingTable(table);
      return;
    }

    if (!editable) {
      // Live mode = cycle status
      const cycle: Record<string, string> = {
        available: "reserved",
        reserved: "occupied",
        occupied: "turning",
        turning: "available",
      };
      const next = cycle[table.status] || "available";
      updateStatusMutation.mutateAsync({ tableId: table.id, status: next as any }).then(() => invalidate());
    }
  }

  async function handleEditSave() {
    if (!editingTable) return;
    await updateMutation.mutateAsync({
      tableId: editingTable.id,
      label: editForm.label,
      capacity: editForm.capacity,
      minCapacity: editForm.minCapacity,
    });
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
    await createMutation.mutateAsync({
      locationId,
      floorPlanId: fpId,
      label: newTable.label,
      capacity: newTable.capacity,
      minCapacity: newTable.minCapacity,
      positionX: 45,
      positionY: 45,
    });
    setShowAddTable(false);
    setNewTable({ label: "", capacity: 4, minCapacity: 1 });
    invalidate();
  }

  // ── Grid lines for edit mode ──

  const gridLines = [];
  if (editable && !locked) {
    for (let i = 0; i <= 100; i += GRID_SNAP) {
      gridLines.push(i);
    }
  }

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
                <Button
                  variant={locked ? "ghost" : "primary"}
                  size="sm"
                  onClick={() => setLocked(!locked)}
                >
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  <span className="text-xs">{locked ? "Edit Tables" : "Dragging"}</span>
                </Button>
                <Button size="sm" onClick={() => setShowAddTable(true)}>
                  <Plus className="h-4 w-4" />
                  Table
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative bg-surface-alt/50 overflow-hidden select-none"
          style={{ height: editable ? 550 : 400 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Grid lines in edit drag mode */}
          {editable && !locked && gridLines.map((pos) => (
            <div key={`gx-${pos}`}>
              <div className="absolute top-0 bottom-0 border-l border-border/30" style={{ left: `${pos}%` }} />
              <div className="absolute left-0 right-0 border-t border-border/30" style={{ top: `${pos}%` }} />
            </div>
          ))}

          {/* Dot grid background (non-edit) */}
          {(locked || !editable) && (
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle, #2a2a2a 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          )}

          {/* Area labels */}
          <div className="absolute top-2 left-3 text-[10px] font-semibold text-text-muted/30 uppercase tracking-wider">
            Dining Room
          </div>
          <div className="absolute bottom-14 left-3 text-[10px] font-semibold text-text-muted/30 uppercase tracking-wider">
            Bar / Lounge
          </div>
          <div className="absolute bottom-14 right-3 text-[10px] font-semibold text-text-muted/30 uppercase tracking-wider">
            Patio
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-ditch-charcoal text-white text-[9px] px-3 py-1 rounded-t-md font-semibold">
            ENTRANCE
          </div>

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            tables?.map((table: any) => {
              const size = getTableSize(table.capacity);
              const shape = getTableShape(table.capacity);
              const style = STATUS_STYLES[table.status] || STATUS_STYLES.available;

              return (
                <div
                  key={table.id}
                  id={`table-${table.id}`}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 transition-shadow",
                    shape,
                    style,
                    !locked && editable
                      ? "cursor-grab active:cursor-grabbing ring-2 ring-primary/30"
                      : editable && locked
                        ? "cursor-pointer hover:ring-2 hover:ring-primary/50"
                        : "cursor-pointer",
                    dragging === table.id && "shadow-lg scale-110 z-10 ring-2 ring-primary",
                    "hover:shadow-md hover:z-10"
                  )}
                  style={{
                    left: `${table.position_x}%`,
                    top: `${table.position_y}%`,
                    width: size,
                    height: size,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, table.id)}
                  onClick={() => handleTableClick(table)}
                >
                  <span className="font-bold text-xs leading-none">{table.label}</span>
                  <span className="text-[9px] opacity-70 leading-none mt-0.5">{table.capacity}p</span>
                  {editable && locked && (
                    <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 text-primary" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border text-xs text-text-muted text-center">
          {tables?.length || 0} tables · {tables?.reduce((s: number, t: any) => s + t.capacity, 0) || 0} total seats
          {editable && !locked && " · Drag tables to reposition (snap to grid)"}
          {editable && locked && " · Click a table to edit it"}
          {!editable && " · Click to cycle status"}
        </div>
      </Card>

      {/* Add Table Modal */}
      <Modal open={showAddTable} onClose={() => setShowAddTable(false)} title="Add Table">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTable(); }} className="space-y-4">
          <Input
            label="Table Label"
            value={newTable.label}
            onChange={(e) => setNewTable({ ...newTable, label: e.target.value })}
            placeholder="e.g. T9, B3, P4"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Capacity" type="number" min={1} max={20} value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 1 })} required />
            <Input label="Min Capacity" type="number" min={1} max={20} value={newTable.minCapacity} onChange={(e) => setNewTable({ ...newTable, minCapacity: parseInt(e.target.value) || 1 })} required />
          </div>
          <p className="text-xs text-text-muted">
            Table will appear in the center. Switch to drag mode to position it.
          </p>
          <Button type="submit" className="w-full" loading={createMutation.isPending}>Add Table</Button>
        </form>
      </Modal>

      {/* Edit Table Modal */}
      <Modal
        open={!!editingTable}
        onClose={() => setEditingTable(null)}
        title={`Edit Table ${editingTable?.label || ""}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleEditSave(); }} className="space-y-4">
          <Input
            label="Table Label"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Capacity" type="number" min={1} max={20} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 1 })} required />
            <Input label="Min Capacity" type="number" min={1} max={20} value={editForm.minCapacity} onChange={(e) => setEditForm({ ...editForm, minCapacity: parseInt(e.target.value) || 1 })} required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={updateMutation.isPending}>Save</Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRemoveTable}
              loading={updateMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
