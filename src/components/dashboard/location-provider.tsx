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
  userRole: string;
  isPlatformAdmin: boolean;
}

const LocationContext = createContext<LocationContextType>({
  locationId: "",
  locationName: "",
  setLocation: () => {},
  locations: [],
  isLoading: true,
  userRole: "",
  isPlatformAdmin: false,
});

export function useLocation() {
  return useContext(LocationContext);
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");

  const { data: me } = trpc.staff.me.useQuery();

  const { data: accessibleLocations, isLoading: accessLoading } =
    trpc.staff.getAccessibleLocations.useQuery();

  const { data: allLocations, isLoading: allLoading } =
    trpc.table.getLocations.useQuery();

  const isLoading = accessLoading || allLoading;

  const locations = (accessibleLocations && accessibleLocations.length > 0)
    ? accessibleLocations.map((al: any) => al.location).filter(Boolean)
    : allLocations || [];

  useEffect(() => {
    if (locations.length > 0 && !locationId) {
      const saved = typeof window !== "undefined"
        ? localStorage.getItem("hostos-location-id")
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
      localStorage.setItem("hostos-location-id", id);
    }
  }

  return (
    <LocationContext.Provider
      value={{ locationId, locationName, setLocation, locations, isLoading, userRole: me?.role || "", isPlatformAdmin: me?.isPlatformAdmin || false }}
    >
      {children}
    </LocationContext.Provider>
  );
}
