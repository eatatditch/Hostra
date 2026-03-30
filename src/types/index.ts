export * from "./enums";

export type LocationId = string;
export type GuestId = string;
export type ReservationId = string;
export type WaitlistEntryId = string;
export type TableId = string;
export type StaffId = string;

export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
  remainingCovers: number;
}

export interface AvailabilityQuery {
  locationId: LocationId;
  date: string; // YYYY-MM-DD
  partySize: number;
}

export interface TriggerResult {
  type: string;
  severity: string;
  message: string;
  payload: Record<string, unknown>;
}
