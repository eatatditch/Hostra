"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, StatusDot } from "@/components/ui";
import { minutesToHumanReadable } from "@/lib/utils";
import { Clock, Users, Hash } from "lucide-react";

export default function WaitlistStatusPage() {
  const { id: token } = useParams<{ id: string }>();

  const { data: entry, isLoading } = trpc.waitlist.checkStatus.useQuery(
    { token },
    { refetchInterval: 15000 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-48 w-80 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center py-8">
          <h2 className="text-lg font-display font-bold">Not Found</h2>
          <p className="text-sm text-text-muted mt-2">
            This waitlist entry was not found or has expired.
          </p>
        </Card>
      </div>
    );
  }

  const isActive = entry.status === "waiting" || entry.status === "notified";

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <Card className="w-full max-w-sm">
        <div className="text-center pb-4">
          <h1 className="text-2xl font-display font-bold text-ditch-charcoal">
            Ditch
          </h1>
          <p className="text-sm text-text-muted mt-1">Waitlist Status</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <StatusDot
              status={entry.status}
              pulse={entry.status === "notified"}
            />
            <span className="text-lg font-semibold capitalize">
              {entry.status === "notified"
                ? "Your Table is Ready!"
                : entry.status === "waiting"
                  ? "Waiting"
                  : entry.status === "seated"
                    ? "Seated"
                    : "Removed"}
            </span>
          </div>

          {isActive && (
            <div className="bg-surface-alt rounded-lg p-4 space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-text-muted" />
                <span>
                  Position: <strong>#{entry.position}</strong>
                </span>
              </div>
              {entry.estimatedWaitMinutes != null && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-text-muted" />
                  <span>
                    ~{minutesToHumanReadable(entry.estimatedWaitMinutes)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-sm">
                <Users className="h-4 w-4 text-text-muted" />
                <span>Party of {entry.partySize}</span>
              </div>
            </div>
          )}

          {entry.status === "notified" && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-sm font-semibold text-primary">
                Please head to the host stand!
              </p>
              <p className="text-xs text-text-muted mt-1">
                We&apos;ll hold your table for 5 minutes.
              </p>
            </div>
          )}

          {isActive && (
            <p className="text-xs text-text-muted text-center">
              This page auto-refreshes every 15 seconds.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
