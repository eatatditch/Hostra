"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, Badge } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import { Search, User, MapPin } from "lucide-react";

export default function GuestsPage() {
  const [query, setQuery] = useState("");

  const { data: allData, isLoading: allLoading } = trpc.guest.listAll.useQuery(
    { limit: 200 },
    { enabled: query.length === 0 }
  );

  const { data: searchResults, isLoading: searchLoading } = trpc.guest.search.useQuery(
    { query },
    { enabled: query.length >= 1 }
  );

  const guests = query.length > 0 ? searchResults : allData?.guests;
  const isLoading = query.length > 0 ? searchLoading : allLoading;
  const totalCount = query.length === 0 ? allData?.total : guests?.length;

  return (
    <div className="p-4 lg:p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">Guests</h1>
          <p className="text-xs text-text-muted">
            {totalCount !== undefined ? `${totalCount} guests` : "Loading..."}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-white text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <Card padding="none" className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
            ))}
          </div>
        ) : !guests || guests.length === 0 ? (
          <p className="p-6 text-sm text-text-muted text-center">
            {query ? "No guests found" : "No guests yet"}
          </p>
        ) : (
          <div className="overflow-y-auto h-full divide-y divide-border">
            {guests.map((guest: any) => (
              <Link
                key={guest.id}
                href={`/guests/${guest.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-alt/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {guest.first_name} {guest.last_name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {formatPhone(guest.phone)}
                      {guest.email && ` · ${guest.email}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {guest.tags?.map((t: any) => (
                    <Badge
                      key={t.id}
                      variant={t.tag === "VIP" ? "primary" : "default"}
                      className="text-[9px]"
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
                    <Badge variant="secondary" className="text-[9px]">
                      <MapPin className="h-2.5 w-2.5" />
                      {guest.metrics.length}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
