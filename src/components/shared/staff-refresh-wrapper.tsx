"use client";

import { type ReactNode, useCallback } from "react";
import { PullToRefresh } from "./pull-to-refresh";
import { trpc } from "@/lib/trpc/client";

export function StaffRefreshWrapper({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  const handleRefresh = useCallback(async () => {
    // Invalidate all cached queries to pull fresh data
    await utils.invalidate();
  }, [utils]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {children}
    </PullToRefresh>
  );
}
