"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, Button, Badge, StatusDot } from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Clock, Users, MapPin, Phone } from "lucide-react";

function DepositStatus({ payments }: { payments?: Array<{
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  type: string;
}> | null }) {
  const deposit = payments?.find((p) => p.type === "deposit");
  if (!deposit) return null;

  const dollars = (deposit.amount_cents / 100).toFixed(2);
  const map: Record<string, { label: string; tone: string }> = {
    requires_payment_method: { label: "Awaiting card", tone: "text-status-warning" },
    requires_confirmation: { label: "Awaiting confirmation", tone: "text-status-warning" },
    requires_action: { label: "Action required", tone: "text-status-warning" },
    processing: { label: "Processing", tone: "text-text-muted" },
    requires_capture: { label: "Card on file", tone: "text-status-success" },
    succeeded: { label: "Charged", tone: "text-status-success" },
    canceled: { label: "Cancelled", tone: "text-text-muted" },
  };
  const { label, tone } = map[deposit.status] || {
    label: deposit.status.replace(/_/g, " "),
    tone: "text-text-muted",
  };

  return (
    <div className="text-sm border-t border-border pt-4">
      <p className="font-medium mb-1">Deposit</p>
      <div className="flex items-center justify-between">
        <span className="text-text-muted">
          ${dollars} {deposit.currency.toUpperCase()}
        </span>
        <span className={`capitalize ${tone}`}>{label}</span>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id: token } = useParams<{ id: string }>();

  const { data: brand } = trpc.table.getBrandSettings.useQuery();

  const { data: reservation, isLoading } =
    trpc.reservation.getByToken.useQuery({ token });

  const cancelMutation = trpc.reservation.cancel.useMutation();
  const utils = trpc.useUtils();

  async function handleCancel() {
    if (!reservation) return;
    await cancelMutation.mutateAsync({
      reservationId: reservation.id,
      token,
    });
    utils.reservation.getByToken.invalidate({ token });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-48 w-80 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center py-8">
          <h2 className="text-lg font-display font-bold">
            Reservation Not Found
          </h2>
          <p className="text-sm text-text-muted mt-2">
            This link may have expired or the reservation was cancelled.
          </p>
        </Card>
      </div>
    );
  }

  const isCancellable =
    reservation.status === "confirmed" || reservation.status === "reminded";

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <Card className="w-full max-w-sm">
        <div className="text-center pb-4">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-12 max-w-[200px] object-contain mx-auto" />
          ) : (
            <h1 className="text-2xl font-display font-bold text-ditch-charcoal">
              {brand?.brand_name || "Ditch"}
            </h1>
          )}
          <p className="text-sm text-text-muted mt-1">Your Reservation</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <div className="flex items-center gap-2">
              <StatusDot status={reservation.status} />
              <span className="text-sm capitalize">
                {reservation.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="bg-surface-alt rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-text-muted" />
              <span>
                {format(
                  new Date(reservation.date + "T00:00:00"),
                  "EEEE, MMMM d, yyyy"
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-text-muted" />
              <span>{formatTime12h(reservation.time)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-text-muted" />
              <span>
                {reservation.party_size}{" "}
                {reservation.party_size === 1 ? "guest" : "guests"}
              </span>
            </div>
            {reservation.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-text-muted" />
                <span>{reservation.location.name}</span>
              </div>
            )}
            {reservation.location?.address && (
              <div className="flex items-center gap-2 text-sm">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(reservation.location.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get Directions
                </a>
              </div>
            )}
            {reservation.location?.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-text-muted" />
                <a href={`tel:${reservation.location.phone}`} className="hover:underline">
                  {reservation.location.phone}
                </a>
              </div>
            )}
            {brand?.website_url && (
              <div className="flex items-center gap-2 text-sm">
                <a
                  href={brand.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Visit Our Website
                </a>
              </div>
            )}
          </div>

          {reservation.special_requests && (
            <div className="text-sm">
              <p className="font-medium mb-1">Special Requests</p>
              <p className="text-text-muted">{reservation.special_requests}</p>
            </div>
          )}

          <DepositStatus payments={(reservation as any).payments} />

          {isCancellable && (
            <Button
              variant="danger"
              className="w-full"
              onClick={handleCancel}
              loading={cancelMutation.isPending}
            >
              Cancel Reservation
            </Button>
          )}

          {cancelMutation.isSuccess && (
            <p className="text-sm text-center text-status-success">
              Your reservation has been cancelled.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
