"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, Badge, Button, StatusDot, TriggerBadge } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import { Clock, Users, MapPin, MessageSquare } from "lucide-react";

interface ReservationListProps {
  locationId: string;
  date: string;
}

export function ReservationList({ locationId, date }: ReservationListProps) {
  const { data: reservations, isLoading } = trpc.reservation.getByDate.useQuery(
    { locationId, date },
    { refetchInterval: 10000 }
  );

  const { data: tables } = trpc.table.getByLocation.useQuery({ locationId });

  const seatMutation = trpc.reservation.seat.useMutation();
  const completeMutation = trpc.reservation.complete.useMutation();
  const noShowMutation = trpc.reservation.markNoShow.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.reservation.getByDate.invalidate({ locationId, date });
    utils.table.getByLocation.invalidate({ locationId });
  }

  async function handleSeat(reservationId: string, tableId: string) {
    await seatMutation.mutateAsync({ reservationId, tableId });
    invalidate();
  }

  async function handleComplete(reservationId: string) {
    await completeMutation.mutateAsync({ reservationId });
    invalidate();
  }

  async function handleNoShow(reservationId: string) {
    await noShowMutation.mutateAsync({ reservationId });
    invalidate();
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  const availableTables = tables?.filter((t) => t.status === "available") || [];

  const statusGroups = {
    upcoming: reservations?.filter((r) => r.status === "confirmed" || r.status === "reminded") || [],
    seated: reservations?.filter((r) => r.status === "seated") || [],
    completed: reservations?.filter((r) => r.status === "completed" || r.status === "no_show" || r.status === "cancelled") || [],
  };

  return (
    <div className="space-y-4">
      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle>
            Upcoming
            <Badge variant="secondary" className="ml-2">
              {statusGroups.upcoming.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        {statusGroups.upcoming.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            No upcoming reservations
          </p>
        ) : (
          <div className="space-y-2">
            {statusGroups.upcoming.map((res) => (
              <div
                key={res.id}
                className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-surface-alt/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status={res.status} />
                    <span className="font-semibold">
                      {res.guest.firstName} {res.guest.lastName}
                    </span>
                    {res.guest.tags?.map((t) => (
                      <Badge
                        key={t.id}
                        variant={t.tag === "VIP" ? "primary" : "default"}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {res.time.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {res.partySize}
                    </span>
                    <span>{formatPhone(res.guest.phone)}</span>
                  </div>
                  {res.specialRequests && (
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {res.specialRequests}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {availableTables.length > 0 && (
                    <select
                      className="text-xs border border-border rounded px-2 py-1"
                      onChange={(e) => {
                        if (e.target.value) handleSeat(res.id, e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Seat at...
                      </option>
                      {availableTables
                        .filter((t) => t.capacity >= res.partySize)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.capacity})
                          </option>
                        ))}
                    </select>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNoShow(res.id)}
                  >
                    No-Show
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Currently Seated */}
      {statusGroups.seated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Seated
              <Badge variant="primary" className="ml-2">
                {statusGroups.seated.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {statusGroups.seated.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status="seated" pulse />
                    <span className="font-semibold">
                      {res.guest.firstName} {res.guest.lastName}
                    </span>
                    {res.table && (
                      <Badge variant="secondary">
                        <MapPin className="h-3 w-3" />
                        {res.table.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>Party of {res.partySize}</span>
                  </div>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => handleComplete(res.id)}
                >
                  Complete
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Completed / Done */}
      {statusGroups.completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Done
              <Badge className="ml-2">{statusGroups.completed.length}</Badge>
            </CardTitle>
          </CardHeader>
          <div className="space-y-1">
            {statusGroups.completed.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-2 rounded text-sm text-text-muted"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={res.status} />
                  <span>
                    {res.guest.firstName} {res.guest.lastName}
                  </span>
                  <span>{res.time.slice(0, 5)}</span>
                </div>
                <span className="capitalize">{res.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
