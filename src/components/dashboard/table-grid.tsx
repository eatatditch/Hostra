"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, StatusDot } from "@/components/ui";
import { cn } from "@/lib/utils";

interface TableGridProps {
  locationId: string;
}

const statusBg: Record<string, string> = {
  available: "bg-status-available/10 border-status-available/30",
  reserved: "bg-status-reserved/10 border-status-reserved/30",
  occupied: "bg-status-occupied/10 border-status-occupied/30",
  turning: "bg-status-turning/10 border-status-turning/30",
};

export function TableGrid({ locationId }: TableGridProps) {
  const { data: tables, isLoading } = trpc.table.getByLocation.useQuery(
    { locationId },
    { refetchInterval: 10000 }
  );

  const updateStatus = trpc.table.updateStatus.useMutation();
  const utils = trpc.useUtils();

  async function cycleStatus(tableId: string, currentStatus: string) {
    const cycle: Record<string, string> = {
      available: "reserved",
      reserved: "occupied",
      occupied: "turning",
      turning: "available",
    };
    const next = cycle[currentStatus] || "available";
    await updateStatus.mutateAsync({
      tableId,
      status: next as "available" | "reserved" | "occupied" | "turning",
    });
    utils.table.getByLocation.invalidate({ locationId });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables</CardTitle>
        <div className="flex items-center gap-3">
          <StatusDot status="available" label />
          <StatusDot status="occupied" label />
          <StatusDot status="turning" label />
        </div>
      </CardHeader>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tables?.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          No tables configured
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {tables?.map((table) => (
            <button
              key={table.id}
              onClick={() => cycleStatus(table.id, table.status)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all cursor-pointer hover:scale-105",
                statusBg[table.status] || statusBg.available
              )}
            >
              <span className="font-bold text-sm">{table.label}</span>
              <span className="text-xs text-text-muted">{table.capacity} seats</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
