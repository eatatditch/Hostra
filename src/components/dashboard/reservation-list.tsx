"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, Badge, Button, StatusDot } from "@/components/ui";
import { formatPhone, formatTime12h } from "@/lib/utils";
import { Clock, Users, MapPin, MessageSquare, Phone, User } from "lucide-react";

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

  const availableTables = tables?.filter((t: any) => t.status === "available") || [];

  const statusGroups = {
    upcoming: reservations?.filter((r: any) => r.status === "confirmed" || r.status === "reminded") || [],
    seated: reservations?.filter((r: any) => r.status === "seated") || [],
    completed: reservations?.filter((r: any) => r.status === "completed" || r.status === "no_show" || r.status === "cancelled") || [],
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
            {statusGroups.upcoming.map((res: any) => (
              <div
                key={res.id}
                className="p-3 rounded-lg border border-border hover:bg-surface-alt/50 transition-colors"
              >
                {/* Guest info — clickable to profile */}
                <Link
                  href={`/guests/${res.guest?.id}`}
                  className="block space-y-1 mb-2"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={res.status} />
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-semibold">
                      {res.guest?.first_name} {res.guest?.last_name}
                    </span>
                    {res.guest?.tags?.map((t: any) => (
                      <Badge
                        key={t.id}
                        variant={t.tag === "VIP" ? "primary" : "default"}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted pl-9">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime12h(res.time)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {res.party_size}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {formatPhone(res.guest?.phone || "")}
                    </span>
                  </div>
                  {res.special_requests && (
                    <p className="text-xs text-text-muted flex items-center gap-1 pl-9">
                      <MessageSquare className="h-3 w-3" />
                      {res.special_requests}
                    </p>
                  )}
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-2 pl-9">
                  {availableTables.length > 0 ? (
                    <select
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) handleSeat(res.id, e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Seat at table...
                      </option>
                      {availableTables
                        .filter((t: any) => t.capacity >= res.party_size)
                        .map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.label} (seats {t.capacity})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-xs text-text-muted italic">No tables available</span>
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
            {statusGroups.seated.map((res: any) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <Link href={`/guests/${res.guest?.id}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status="seated" pulse />
                    <span className="font-semibold">
                      {res.guest?.first_name} {res.guest?.last_name}
                    </span>
                    {res.table && (
                      <Badge variant="secondary">
                        <MapPin className="h-3 w-3" />
                        {res.table.label}
                      </Badge>
                    )}
                    {res.guest?.tags?.map((t: any) => (
                      <Badge
                        key={t.id}
                        variant={t.tag === "VIP" ? "primary" : "default"}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>Party of {res.party_size}</span>
                    <span>{formatPhone(res.guest?.phone || "")}</span>
                    <span>{formatTime12h(res.time)}</span>
                  </div>
                </Link>
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
            {statusGroups.completed.map((res: any) => (
              <Link
                href={`/guests/${res.guest?.id}`}
                key={res.id}
                className="flex items-center justify-between p-2 rounded text-sm text-text-muted hover:bg-surface-alt/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={res.status} />
                  <span>
                    {res.guest?.first_name} {res.guest?.last_name}
                  </span>
                  <span>{formatTime12h(res.time)}</span>
                </div>
                <span className="capitalize">{res.status.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
