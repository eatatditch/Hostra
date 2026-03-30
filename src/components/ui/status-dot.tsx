import { cn } from "@/lib/utils";
import { TableStatus, ReservationStatus, WaitlistStatus } from "@/types";

type StatusType = TableStatus | ReservationStatus | WaitlistStatus | string;

const statusColors = new Map<string, string>([
  // Table statuses
  [TableStatus.AVAILABLE, "bg-status-available"],
  [TableStatus.OCCUPIED, "bg-status-occupied"],
  [TableStatus.RESERVED, "bg-status-reserved"],
  [TableStatus.TURNING, "bg-status-turning"],
  // Reservation statuses
  [ReservationStatus.CONFIRMED, "bg-status-reserved"],
  [ReservationStatus.REMINDED, "bg-status-reserved"],
  [ReservationStatus.SEATED, "bg-status-occupied"],
  [ReservationStatus.COMPLETED, "bg-status-success"],
  [ReservationStatus.NO_SHOW, "bg-status-error"],
  [ReservationStatus.CANCELLED, "bg-text-muted"],
  // Waitlist statuses (shared keys like "seated" resolved by Map — last write wins)
  [WaitlistStatus.WAITING, "bg-status-warning"],
  [WaitlistStatus.NOTIFIED, "bg-status-occupied"],
  [WaitlistStatus.REMOVED, "bg-text-muted"],
]);

interface StatusDotProps {
  status: StatusType;
  label?: string | boolean;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ status, label, pulse, className }: StatusDotProps) {
  const color = statusColors.get(status) || "bg-text-muted";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              color
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)}
        />
      </span>
      {label && (
        <span className="text-xs font-medium text-text-muted capitalize">
          {status.replace(/_/g, " ")}
        </span>
      )}
    </span>
  );
}
