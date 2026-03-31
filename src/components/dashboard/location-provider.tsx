"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc/client";

interface LocationContextType {
  locationId: string;
  locationName: string;
  setLocation: (id: string, name: string) => void;
  locations: { id: string; name: string; slug: string }[];
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType>({
  locationId: "",
  locationName: "",
  setLocation: () => {},
  locations: [],
  isLoading: true,
});

export function useLocation() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");

  // Use staff-accessible locations instead of all locations
  const { data: accessibleLocations, isLoading: accessLoading } =
    trpc.staff.getAccessibleLocations.useQuery();

  // Fallback to all locations if staff_locations is empty (backward compat)
  const { data: allLocations, isLoading: allLoading } =
    trpc.table.getLocations.useQuery();

  const isLoading = accessLoading || allLoading;

  // Use accessible locations if available, otherwise fall back to all
  const locations = (accessibleLocations && accessibleLocations.length > 0)
    ? accessibleLocations.map((al: any) => al.location).filter(Boolean)
    : allLocations || [];

  useEffect(() => {
    if (locations.length > 0 && !locationId) {
      const saved = typeof window !== "undefined"
        ? localStorage.getItem("hostra-location-id")
        : null;
      const match = saved ? locations.find((l: any) => l.id === saved) : null;
      const loc = match || locations[0];
      setLocationId(loc.id);
      setLocationName(loc.name);
    }
  }, [locations, locationId]);

  function setLocation(id: string, name: string) {
    setLocationId(id);
    setLocationName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("hostra-location-id", id);
    }
  }

  return (
    <LocationContext.Provider
      value={{ locationId, locationName, setLocation, locations, isLoading }}
    >
      {children}
    </LocationContext.Provider>
  );
}
