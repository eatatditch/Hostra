import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  date,
  time,
  jsonb,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  reservationStatusEnum,
  waitlistStatusEnum,
  tableStatusEnum,
  staffRoleEnum,
  bookingSourceEnum,
  commChannelEnum,
  commDirectionEnum,
  commStatusEnum,
  triggerTypeEnum,
  triggerSeverityEnum,
} from "./enums";

// ── Location ──────────────────────────────────────────────

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("America/New_York"),
  settings: jsonb("settings").default({}),
  pacingCapPerSlot: integer("pacing_cap_per_slot"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Staff ─────────────────────────────────────────────────

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: staffRoleEnum("role").notNull().default("host"),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_location_idx").on(table.locationId),
    index("staff_auth_user_idx").on(table.authUserId),
  ]
);

// ── Floor Plan ────────────────────────────────────────────

export const floorPlans = pgTable(
  "floor_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    name: varchar("name", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("floor_plan_location_idx").on(table.locationId)]
);

// ── Table ─────────────────────────────────────────────────

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    floorPlanId: uuid("floor_plan_id")
      .notNull()
      .references(() => floorPlans.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    label: varchar("label", { length: 20 }).notNull(),
    capacity: integer("capacity").notNull(),
    minCapacity: integer("min_capacity").notNull().default(1),
    positionX: real("position_x").default(0),
    positionY: real("position_y").default(0),
    status: tableStatusEnum("status").notNull().default("available"),
    combinable: boolean("combinable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("table_floor_plan_idx").on(table.floorPlanId),
    index("table_location_idx").on(table.locationId),
  ]
);

// ── Guest ─────────────────────────────────────────────────

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),
    dateOfBirth: date("date_of_birth"),
    anniversaryDate: date("anniversary_date"),
    dietaryRestrictions: text("dietary_restrictions"),
    allergies: text("allergies"),
    smsOptOut: boolean("sms_opt_out").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("guest_phone_idx").on(table.phone),
    index("guest_email_idx").on(table.email),
  ]
);

// ── Guest Tags ────────────────────────────────────────────

export const guestTags = pgTable(
  "guest_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 50 }).notNull(),
    createdBy: uuid("created_by").references(() => staff.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("guest_tag_guest_idx").on(table.guestId),
    uniqueIndex("guest_tag_unique").on(table.guestId, table.tag),
  ]
);

// ── Guest Notes ───────────────────────────────────────────

export const guestNotes = pgTable(
  "guest_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id),
    content: text("content").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("guest_note_guest_idx").on(table.guestId)]
);

// ── Guest Metrics (per-location denormalized) ─────────────

export const guestMetrics = pgTable(
  "guest_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    totalVisits: integer("total_visits").notNull().default(0),
    noShowCount: integer("no_show_count").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
    avgPartySize: real("avg_party_size"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("guest_metrics_unique").on(table.guestId, table.locationId),
    index("guest_metrics_guest_idx").on(table.guestId),
    index("guest_metrics_location_idx").on(table.locationId),
  ]
);

// ── Service Shift ─────────────────────────────────────────

export const serviceShifts = pgTable(
  "service_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    name: varchar("name", { length: 100 }).notNull(),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 6=Sat
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    maxCovers: integer("max_covers").notNull(),
    slotDurationMin: integer("slot_duration_min").notNull().default(30),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("service_shift_location_idx").on(table.locationId),
    index("service_shift_day_idx").on(table.locationId, table.dayOfWeek),
  ]
);

// ── Reservation ───────────────────────────────────────────

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    tableId: uuid("table_id").references(() => tables.id),
    date: date("date").notNull(),
    time: time("time").notNull(),
    partySize: integer("party_size").notNull(),
    status: reservationStatusEnum("status").notNull().default("confirmed"),
    source: bookingSourceEnum("source").notNull().default("web"),
    specialRequests: text("special_requests"),
    confirmationToken: varchar("confirmation_token", { length: 64 }).notNull(),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reservation_location_date_idx").on(table.locationId, table.date),
    index("reservation_guest_idx").on(table.guestId),
    index("reservation_status_idx").on(table.locationId, table.status),
    uniqueIndex("reservation_token_idx").on(table.confirmationToken),
  ]
);

// ── Waitlist Entry ────────────────────────────────────────

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    tableId: uuid("table_id").references(() => tables.id),
    partySize: integer("party_size").notNull(),
    position: integer("position").notNull(),
    estimatedWaitMinutes: integer("estimated_wait_minutes"),
    status: waitlistStatusEnum("status").notNull().default("waiting"),
    source: bookingSourceEnum("source").notNull().default("walk_in"),
    checkToken: varchar("check_token", { length: 64 }).notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("waitlist_location_status_idx").on(table.locationId, table.status),
    index("waitlist_guest_idx").on(table.guestId),
    uniqueIndex("waitlist_token_idx").on(table.checkToken),
  ]
);

// ── Visit (canonical seated event) ────────────────────────

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    waitlistEntryId: uuid("waitlist_entry_id").references(() => waitlistEntries.id),
    tableId: uuid("table_id").references(() => tables.id),
    partySize: integer("party_size").notNull(),
    seatedAt: timestamp("seated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("visit_guest_idx").on(table.guestId),
    index("visit_location_date_idx").on(table.locationId, table.seatedAt),
  ]
);

// ── Communication ─────────────────────────────────────────

export const communications = pgTable(
  "communications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    channel: commChannelEnum("channel").notNull(),
    direction: commDirectionEnum("direction").notNull().default("outbound"),
    templateKey: varchar("template_key", { length: 100 }),
    content: text("content").notNull(),
    status: commStatusEnum("status").notNull().default("queued"),
    externalId: varchar("external_id", { length: 255 }),
    relatedType: varchar("related_type", { length: 50 }),
    relatedId: uuid("related_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("comm_guest_idx").on(table.guestId),
    index("comm_location_idx").on(table.locationId),
  ]
);

// ── Communication Template ────────────────────────────────

export const communicationTemplates = pgTable(
  "communication_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    key: varchar("key", { length: 100 }).notNull(),
    channel: commChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 255 }),
    body: text("body").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("comm_template_unique").on(table.locationId, table.key, table.channel),
  ]
);

// ── Payment ───────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_guest_idx").on(table.guestId),
    index("payment_reservation_idx").on(table.reservationId),
    uniqueIndex("payment_intent_idx").on(table.stripePaymentIntentId),
  ]
);

// ── Trigger Event ─────────────────────────────────────────

export const triggerEvents = pgTable(
  "trigger_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id),
    reservationId: uuid("reservation_id").references(() => reservations.id),
    waitlistEntryId: uuid("waitlist_entry_id").references(() => waitlistEntries.id),
    triggerType: triggerTypeEnum("trigger_type").notNull(),
    severity: triggerSeverityEnum("severity").notNull().default("info"),
    payload: jsonb("payload").default({}),
    actioned: boolean("actioned").notNull().default(false),
    actionedBy: uuid("actioned_by").references(() => staff.id),
    actionedNote: text("actioned_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trigger_event_guest_idx").on(table.guestId),
    index("trigger_event_location_idx").on(table.locationId),
    index("trigger_event_reservation_idx").on(table.reservationId),
  ]
);

// ── Trigger Config ────────────────────────────────────────

export const triggerConfigs = pgTable(
  "trigger_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    triggerType: triggerTypeEnum("trigger_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    threshold: jsonb("threshold").default({}),
    priority: integer("priority").notNull().default(0),
    updatedBy: uuid("updated_by").references(() => staff.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trigger_config_unique").on(table.locationId, table.triggerType),
  ]
);

// ── Relations ─────────────────────────────────────────────

export const locationsRelations = relations(locations, ({ many }) => ({
  staff: many(staff),
  floorPlans: many(floorPlans),
  tables: many(tables),
  serviceShifts: many(serviceShifts),
  reservations: many(reservations),
  waitlistEntries: many(waitlistEntries),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  location: one(locations, {
    fields: [staff.locationId],
    references: [locations.id],
  }),
}));

export const guestsRelations = relations(guests, ({ many }) => ({
  tags: many(guestTags),
  notes: many(guestNotes),
  metrics: many(guestMetrics),
  reservations: many(reservations),
  waitlistEntries: many(waitlistEntries),
  visits: many(visits),
  communications: many(communications),
}));

export const guestTagsRelations = relations(guestTags, ({ one }) => ({
  guest: one(guests, {
    fields: [guestTags.guestId],
    references: [guests.id],
  }),
}));

export const guestNotesRelations = relations(guestNotes, ({ one }) => ({
  guest: one(guests, {
    fields: [guestNotes.guestId],
    references: [guests.id],
  }),
  staffMember: one(staff, {
    fields: [guestNotes.staffId],
    references: [staff.id],
  }),
}));

export const guestMetricsRelations = relations(guestMetrics, ({ one }) => ({
  guest: one(guests, {
    fields: [guestMetrics.guestId],
    references: [guests.id],
  }),
  location: one(locations, {
    fields: [guestMetrics.locationId],
    references: [locations.id],
  }),
}));

export const floorPlansRelations = relations(floorPlans, ({ one, many }) => ({
  location: one(locations, {
    fields: [floorPlans.locationId],
    references: [locations.id],
  }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one }) => ({
  floorPlan: one(floorPlans, {
    fields: [tables.floorPlanId],
    references: [floorPlans.id],
  }),
  location: one(locations, {
    fields: [tables.locationId],
    references: [locations.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  location: one(locations, {
    fields: [reservations.locationId],
    references: [locations.id],
  }),
  guest: one(guests, {
    fields: [reservations.guestId],
    references: [guests.id],
  }),
  table: one(tables, {
    fields: [reservations.tableId],
    references: [tables.id],
  }),
  triggerEvents: many(triggerEvents),
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  location: one(locations, {
    fields: [waitlistEntries.locationId],
    references: [locations.id],
  }),
  guest: one(guests, {
    fields: [waitlistEntries.guestId],
    references: [guests.id],
  }),
  table: one(tables, {
    fields: [waitlistEntries.tableId],
    references: [tables.id],
  }),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  guest: one(guests, {
    fields: [visits.guestId],
    references: [guests.id],
  }),
  location: one(locations, {
    fields: [visits.locationId],
    references: [locations.id],
  }),
  reservation: one(reservations, {
    fields: [visits.reservationId],
    references: [reservations.id],
  }),
  table: one(tables, {
    fields: [visits.tableId],
    references: [tables.id],
  }),
}));

export const communicationsRelations = relations(communications, ({ one }) => ({
  guest: one(guests, {
    fields: [communications.guestId],
    references: [guests.id],
  }),
  location: one(locations, {
    fields: [communications.locationId],
    references: [locations.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  guest: one(guests, {
    fields: [payments.guestId],
    references: [guests.id],
  }),
  reservation: one(reservations, {
    fields: [payments.reservationId],
    references: [reservations.id],
  }),
}));

export const triggerEventsRelations = relations(triggerEvents, ({ one }) => ({
  guest: one(guests, {
    fields: [triggerEvents.guestId],
    references: [guests.id],
  }),
  location: one(locations, {
    fields: [triggerEvents.locationId],
    references: [locations.id],
  }),
  reservation: one(reservations, {
    fields: [triggerEvents.reservationId],
    references: [reservations.id],
  }),
  actionedByStaff: one(staff, {
    fields: [triggerEvents.actionedBy],
    references: [staff.id],
  }),
}));
