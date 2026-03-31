"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, StatusDot, Badge, Button, Modal, Input } from "@/components/ui";
import { Plus, Lock, Unlock } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-status-available/15 border-status-available text-status-available",
  reserved: "bg-status-reserved/15 border-status-reserved text-status-reserved",
  occupied: "bg-status-occupied/15 border-status-occupied text-status-occupied",
  turning: "bg-status-turning/15 border-status-turning text-status-turning",
};

const TABLE_SIZE_BASE = 56; // px for a 2-top
const TABLE_SIZE_SCALE = 12; // additional px per extra seat

function getTableSize(capacity: number) {
  const size = TABLE_SIZE_BASE + Math.min(capacity - 1, 6) * TABLE_SIZE_SCALE;
  return size;
}

function getTableShape(capacity: number): string {
  if (capacity <= 2) return "rounded-full";
  if (capacity <= 4) return "rounded-xl";
  if (capacity <= 6) return "rounded-2xl";
  return "rounded-2xl";
}

interface FloorPlanProps {
  locationId: string;
  editable?: boolean;
  onTableClick?: (table: any) => void;
}

export function FloorPlan({ locationId, editable = false, onTableClick }: FloorPlanProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(!editable);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTable, setNewTable] = useState({ label: "", capacity: 4, minCapacity: 1 });

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, tableId: string) => {
      if (locked && !editable) return;
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
    [locked, editable, tables]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      let y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      // Clamp to canvas
      x = Math.max(0, Math.min(88, x));
      y = Math.max(0, Math.min(88, y));

      // Optimistic local update
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
      x = Math.max(0, Math.min(88, x));
      y = Math.max(0, Math.min(88, y));

      await updateMutation.mutateAsync({
        tableId: dragging,
        positionX: Math.round(x * 10) / 10,
        positionY: Math.round(y * 10) / 10,
      });
      setDragging(null);
      invalidate();
    },
    [dragging, dragOffset, updateMutation]
  );

  function handleTableClick(table: any) {
    if (dragging) return;
    if (onTableClick) {
      onTableClick(table);
      return;
    }
    // Default: cycle status
    if (!editable) {
      const cycle: Record<string, string> = {
        available: "reserved",
        reserved: "occupied",
        occupied: "turning",
        turning: "available",
      };
      const next = cycle[table.status] || "available";
      updateStatusMutation.mutateAsync({
        tableId: table.id,
        status: next as any,
      }).then(() => invalidate());
    }
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

  return (
    <>
      <Card padding="none">
        <div className="p-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Floor Plan</h3>
            <div className="flex items-center gap-2">
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
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocked(!locked)}
                  title={locked ? "Unlock to drag tables" : "Lock positions"}
                >
                  {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-primary" />}
                  <span className="text-xs">{locked ? "Locked" : "Unlocked"}</span>
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
          style={{ height: 500 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Grid dots background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, #2a2a2a 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Area labels */}
          <div className="absolute top-2 left-3 text-[10px] font-semibold text-text-muted/40 uppercase tracking-wider">
            Dining Room
          </div>
          <div className="absolute bottom-14 left-3 text-[10px] font-semibold text-text-muted/40 uppercase tracking-wider">
            Bar / Lounge
          </div>
          <div className="absolute bottom-14 right-3 text-[10px] font-semibold text-text-muted/40 uppercase tracking-wider">
            Patio
          </div>

          {/* Entrance indicator */}
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
                    !locked && editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    dragging === table.id && "shadow-lg scale-110 z-10",
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
                </div>
              );
            })
          )}
        </div>

        {/* Table count */}
        <div className="p-2 border-t border-border text-xs text-text-muted text-center">
          {tables?.length || 0} tables · {tables?.reduce((s: number, t: any) => s + t.capacity, 0) || 0} total seats
          {editable && !locked && " · Drag tables to reposition"}
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
            <Input
              label="Max Capacity"
              type="number"
              min={1}
              max={20}
              value={newTable.capacity}
              onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 1 })}
              required
            />
            <Input
              label="Min Capacity"
              type="number"
              min={1}
              max={20}
              value={newTable.minCapacity}
              onChange={(e) => setNewTable({ ...newTable, minCapacity: parseInt(e.target.value) || 1 })}
              required
            />
          </div>
          <p className="text-xs text-text-muted">
            New table will appear in the center of the floor plan. Unlock and drag to position it.
          </p>
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Add Table
          </Button>
        </form>
      </Modal>
    </>
  );
}
