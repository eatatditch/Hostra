"use client";

import { FloorPlan } from "./floor-plan";

interface TableGridProps {
  locationId: string;
}

export function TableGrid({ locationId }: TableGridProps) {
  return <FloorPlan locationId={locationId} />;
}
