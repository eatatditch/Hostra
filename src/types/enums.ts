export const ReservationStatus = {
  CONFIRMED: "confirmed",
  REMINDED: "reminded",
  SEATED: "seated",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
} as const;
export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const WaitlistStatus = {
  WAITING: "waiting",
  NOTIFIED: "notified",
  SEATED: "seated",
  REMOVED: "removed",
  NO_SHOW: "no_show",
} as const;
export type WaitlistStatus =
  (typeof WaitlistStatus)[keyof typeof WaitlistStatus];

export const TableStatus = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  OCCUPIED: "occupied",
  TURNING: "turning",
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const StaffRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  HOST: "host",
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const BookingSource = {
  WEB: "web",
  PHONE: "phone",
  WALK_IN: "walk_in",
  STAFF: "staff",
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

export const CommunicationChannel = {
  SMS: "sms",
  EMAIL: "email",
} as const;
export type CommunicationChannel =
  (typeof CommunicationChannel)[keyof typeof CommunicationChannel];

export const CommunicationDirection = {
  OUTBOUND: "outbound",
  INBOUND: "inbound",
} as const;
export type CommunicationDirection =
  (typeof CommunicationDirection)[keyof typeof CommunicationDirection];

export const CommunicationStatus = {
  QUEUED: "queued",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
} as const;
export type CommunicationStatus =
  (typeof CommunicationStatus)[keyof typeof CommunicationStatus];

export const TriggerType = {
  BIRTHDAY: "birthday",
  ANNIVERSARY: "anniversary",
  FIRST_VISIT: "first_visit",
  RETURNING_AFTER_ABSENCE: "returning_after_absence",
  VIP: "vip",
  HIGH_FREQUENCY: "high_frequency",
  NO_SHOW_RISK: "no_show_risk",
  PREFERRED_SEATING: "preferred_seating",
  PRIOR_ISSUE: "prior_issue",
  MILESTONE_VISIT: "milestone_visit",
  LARGE_PARTY: "large_party",
  SPECIAL_REQUEST: "special_request",
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

export const TriggerSeverity = {
  INFO: "info",
  ACTION: "action",
  CRITICAL: "critical",
} as const;
export type TriggerSeverity =
  (typeof TriggerSeverity)[keyof typeof TriggerSeverity];
