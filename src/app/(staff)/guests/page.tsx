"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, Badge } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import { Search, User, MapPin } from "lucide-react";

export default function GuestsPage() {
  const [query, setQuery] = useState("");

  const { data: guests, isLoading } = trpc.guest.search.useQuery(
    { query },
    { enabled: query.length >= 1 }
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Guests</h1>
        <p className="text-sm text-text-muted">
          Unified guest directory across all locations
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {query.length > 0 && (
        <Card padding="none">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-alt rounded animate-pulse" />
              ))}
            </div>
          ) : guests?.length === 0 ? (
            <p className="p-6 text-sm text-text-muted text-center">
              No guests found
            </p>
          ) : (
            <div className="divide-y divide-border">
              {guests?.map((guest: any) => (
                <Link
                  key={guest.id}
                  href={`/guests/${guest.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {guest.first_name} {guest.last_name}
                      </p>
                      <p className="text-sm text-text-muted">
                        {formatPhone(guest.phone)}
                        {guest.email && ` · ${guest.email}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {guest.tags?.map((t: any) => (
                      <Badge
                        key={t.id}
                        variant={t.tag === "VIP" ? "primary" : "default"}
                      >
                        {t.tag}
                      </Badge>
                    ))}
                    {guest.totalVisitsAllLocations > 0 && (
                      <span className="text-xs text-text-muted">
                        {guest.totalVisitsAllLocations} visits
                      </span>
                    )}
                    {(guest.metrics?.length || 0) > 1 && (
                      <Badge variant="secondary">
                        <MapPin className="h-3 w-3" />
                        {guest.metrics.length} locations
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
