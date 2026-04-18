import { pgEnum } from "drizzle-orm/pg-core";

export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending_deposit",
  "confirmed",
  "reminded",
  "seated",
  "completed",
  "no_show",
  "cancelled",
]);

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "notified",
  "seated",
  "removed",
  "no_show",
]);

export const tableStatusEnum = pgEnum("table_status", [
  "available",
  "reserved",
  "occupied",
  "turning",
]);

export const staffRoleEnum = pgEnum("staff_role", [
  "admin",
  "manager",
  "host",
]);

export const bookingSourceEnum = pgEnum("booking_source", [
  "web",
  "phone",
  "walk_in",
  "staff",
]);

export const commChannelEnum = pgEnum("comm_channel", ["sms", "email"]);

export const commDirectionEnum = pgEnum("comm_direction", [
  "outbound",
  "inbound",
]);

export const commStatusEnum = pgEnum("comm_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "birthday",
  "anniversary",
  "first_visit",
  "returning_after_absence",
  "vip",
  "high_frequency",
  "no_show_risk",
  "preferred_seating",
  "prior_issue",
  "milestone_visit",
  "large_party",
  "special_request",
]);

export const triggerSeverityEnum = pgEnum("trigger_severity", [
  "info",
  "action",
  "critical",
]);
