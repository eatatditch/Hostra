"use client";

import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, Button } from "@/components/ui";
import { ChevronLeft, ChevronRight, Users, XCircle, Clock, Zap } from "lucide-react";

const DEMO_LOCATION_ID = "00000000-0000-0000-0000-000000000001";

export default function ReportsPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: summary, isLoading } = trpc.analytics.dailySummary.useQuery({
    locationId: DEMO_LOCATION_ID,
    date,
  });

  const { data: trend } = trpc.analytics.weeklyTrend.useQuery({
    locationId: DEMO_LOCATION_ID,
    endDate: date,
  });

  function shiftDate(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(format(d, "yyyy-MM-dd"));
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Reports</h1>
          <p className="text-sm text-text-muted">
            {format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
          >
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-alt rounded-xl animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalCovers}</p>
                  <p className="text-xs text-text-muted">Covers</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {summary.totalReservations}
                  </p>
                  <p className="text-xs text-text-muted">Reservations</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-status-error/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-status-error" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.noShowCount}</p>
                  <p className="text-xs text-text-muted">No-Shows</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {summary.triggersActioned}/{summary.triggersTotal}
                  </p>
                  <p className="text-xs text-text-muted">Triggers</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Seated</span>
                  <span className="font-medium">{summary.seatedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">No-Shows</span>
                  <span className="font-medium text-status-error">
                    {summary.noShowCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Cancelled</span>
                  <span className="font-medium">{summary.cancelledCount}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-text-muted">Avg Party Size</span>
                  <span className="font-medium">
                    {summary.avgPartySize.toFixed(1)}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Waitlist</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Joined</span>
                  <span className="font-medium">{summary.waitlistJoins}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Seated from Waitlist</span>
                  <span className="font-medium">{summary.waitlistSeated}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-text-muted">Conversion</span>
                  <span className="font-medium">
                    {summary.waitlistJoins > 0
                      ? Math.round(
                          (summary.waitlistSeated / summary.waitlistJoins) * 100
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* Weekly trend */}
      {trend && trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>7-Day Trend</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {trend.map((day) => (
              <div
                key={day.date}
                className="flex items-center gap-4 text-sm"
              >
                <span className="w-20 text-text-muted shrink-0">
                  {format(new Date(day.date + "T00:00:00"), "EEE MMM d")}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="h-6 bg-primary/20 rounded"
                    style={{
                      width: `${Math.max(4, (day.covers / (Math.max(...trend.map((t) => t.covers), 1))) * 100)}%`,
                    }}
                  />
                  <span className="text-xs font-medium">
                    {day.covers} covers
                  </span>
                </div>
                {day.noShows > 0 && (
                  <span className="text-xs text-status-error">
                    {day.noShows} NS
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
