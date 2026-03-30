import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Reservation statuses                                                */
/* ------------------------------------------------------------------ */

const RESERVATION_STATUS_CONFIG = {
  confirmed: {
    label: "Confirmed",
    className: "bg-ditch-blue/10 text-ditch-blue border-ditch-blue/20",
  },
  reminded: {
    label: "Reminded",
    className: "bg-ditch-blue-light/10 text-ditch-blue-light border-ditch-blue-light/20",
  },
  arrived: {
    label: "Arrived",
    className: "bg-ditch-green/10 text-ditch-green border-ditch-green/20",
  },
  seated: {
    label: "Seated",
    className: "bg-ditch-green-dark/10 text-ditch-green-dark border-ditch-green-dark/20",
  },
  completed: {
    label: "Completed",
    className: "bg-ditch-gray/10 text-ditch-gray border-ditch-gray/20",
  },
  canceled: {
    label: "Canceled",
    className: "bg-ditch-error/10 text-ditch-error border-ditch-error/20",
  },
  no_show: {
    label: "No Show",
    className: "bg-ditch-error-dark/10 text-ditch-error-dark border-ditch-error-dark/20",
  },
} as const;

export type ReservationStatus = keyof typeof RESERVATION_STATUS_CONFIG;

/* ------------------------------------------------------------------ */
/* Waitlist statuses                                                    */
/* ------------------------------------------------------------------ */

const WAITLIST_STATUS_CONFIG = {
  joined: {
    label: "Joined",
    className: "bg-ditch-blue/10 text-ditch-blue border-ditch-blue/20",
  },
  quoted: {
    label: "Quoted",
    className: "bg-ditch-orange/10 text-ditch-orange border-ditch-orange/20",
  },
  notified: {
    label: "Notified",
    className: "bg-ditch-orange-light/10 text-ditch-orange-light border-ditch-orange-light/20",
  },
  arrived: {
    label: "Arrived",
    className: "bg-ditch-green/10 text-ditch-green border-ditch-green/20",
  },
  checked_in: {
    label: "Checked In",
    className: "bg-ditch-green/10 text-ditch-green border-ditch-green/20",
  },
  seated: {
    label: "Seated",
    className: "bg-ditch-green-dark/10 text-ditch-green-dark border-ditch-green-dark/20",
  },
  canceled: {
    label: "Canceled",
    className: "bg-ditch-gray/10 text-ditch-gray border-ditch-gray/20",
  },
  no_show: {
    label: "No Show",
    className: "bg-ditch-error/10 text-ditch-error border-ditch-error/20",
  },
  expired: {
    label: "Expired",
    className: "bg-ditch-gray-dark/10 text-ditch-gray-dark border-ditch-gray-dark/20",
  },
} as const;

export type WaitlistStatus = keyof typeof WAITLIST_STATUS_CONFIG;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ReservationStatus | WaitlistStatus;
  type?: "reservation" | "waitlist";
}

function StatusBadge({
  status,
  type = "reservation",
  className,
  ...props
}: StatusBadgeProps) {
  const config =
    type === "waitlist"
      ? WAITLIST_STATUS_CONFIG[status as WaitlistStatus]
      : RESERVATION_STATUS_CONFIG[status as ReservationStatus];

  if (!config) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-ditch-gray/10 text-ditch-gray border-ditch-gray/20",
          className
        )}
        {...props}
      >
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
      {...props}
    >
      {config.label}
    </span>
  );
}

export { StatusBadge, RESERVATION_STATUS_CONFIG, WAITLIST_STATUS_CONFIG };
