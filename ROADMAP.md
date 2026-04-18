# HostOS Roadmap

Each line below is one day's work, sized to ship in a single Claude Code Routine run.
The routine (see `ROUTINE_PROMPT.md`) picks the first unchecked item, implements it,
opens a PR, and flips the checkbox.

Naming convention: `**Day N · slug** — body`. `slug` is stable (safe to reference in
branch names and PR titles); body can be edited freely.

## Phase 1 — Revenue protection

- [x] **Day 1 · pacing-controls** — Cap covers per 15-min slot. Add `pacing_cap_per_slot` (int) to `location_settings`. Enforce in `getAvailableSlots` by counting existing reservations per slot and marking `available: false` when ≥ cap. Settings UI under Settings → Reservations to edit the cap.
- [ ] **Day 2 · stripe-setup** — Add `stripe` SDK. Env scaffolding: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. New `payments` table (id, guest_id, reservation_id, amount_cents, currency, stripe_payment_intent_id, status, type, created_at). New `payment` tRPC router with `createIntent`, `capture`, `refund`. Webhook route at `/api/stripe/webhook` reconciling status.
- [ ] **Day 3 · reservation-deposits** — Per-location `deposit_amount_cents` and `deposit_min_party_size` settings. Booking flow creates a manual-capture PaymentIntent when party ≥ threshold; reservation blocked until client-side confirm. Show deposit state on reservation detail.
- [ ] **Day 4 · no-show-fees** — In `markNoShow`, if there's a linked payment with status `requires_capture`, capture it. Surface captured fee in reservation detail and guest profile.
- [ ] **Day 5 · cancellation-policy** — Per-location `cancellation_window_hours` and `cancellation_refund_percent`. On `cancelReservation` inside window, refund pending deposit at percent. Expose policy on the guest booking confirmation page.

## Phase 2 — Ops visibility

- [ ] **Day 6 · reservation-grid** — Timeline view at `/dashboard/grid`: tables (rows) × 15-min slots (cols). Reservations render as blocks. Drag a block to reassign time/table (calls existing `reservation.update` / `reservation.seat`).
- [ ] **Day 7 · audit-log** — `audit_events` table (id, actor_id, location_id, entity_type, entity_id, action, before, after, created_at). Wrap mutations in reservation/waitlist/guest routers. Admin-only viewer at `/admin/audit`.
- [ ] **Day 8 · server-sections** — Add `section` column on tables. Add `server_id`, `section` to reservations set at seating. Round-robin server assignment among on-duty staff within the table's section.
- [ ] **Day 9 · smart-quote-times** — Replace the constant-average logic in `estimateWaitTime` with a per-party-size percentile (p75) over last 30 days of visits. Include variance on the host UI.
- [ ] **Day 10 · forecast-dashboard** — Reports page shows a "Today forecast": covers = rolling 4-week same-weekday average. Overlay forecast vs actual by slot.

## Phase 3 — CRM & communications

- [ ] **Day 11 · sms-inbox** — `/messages` route. Thread-per-guest view using existing `communications` table. Reply box sends outbound via Twilio.
- [ ] **Day 12 · post-visit-nudge** — On `completeReservation`, schedule (Inngest) a 2-hour-delayed message with Google/Yelp review links. Per-location template in settings.
- [ ] **Day 13 · guest-segments** — `guest_segments` table (id, location_id, name, filter_json). UI to save queries (VIP, lapsed 90d, birthday this month). Show live count.
- [ ] **Day 14 · campaign-sender** — `campaigns` table + router. UI to pick segment, channel, template, and schedule. Sends via existing communications dispatcher.
- [ ] **Day 15 · guest-photos** — Avatar upload to Supabase storage. Display on guest profile and host-stand rows.
- [ ] **Day 16 · channel-preferences** — Per-guest opt-in matrix: transactional SMS, transactional email, marketing SMS, marketing email. Dispatcher honors matrix.

## Phase 4 — Growth & distribution

- [ ] **Day 17 · booking-widget** — Public standalone route `/widget/[locationId]` + a `<script>` embed snippet for restaurant sites. Minimal CSS, themeable via query params.
- [ ] **Day 18 · notify-me** — Public waitlist for sold-out dates. `notify_entries` table (guest_id, location_id, target_date, party_size). On a reservation cancel/update that frees inventory, auto-notify matching entries by SMS/email.
- [ ] **Day 19 · source-attribution** — `source` and `utm_source|medium|campaign` columns on reservations. Capture in booking flow (widget, Google Reserve, staff). Reports breakdown.
- [ ] **Day 20 · yelp-channel** — Yelp reservations partner feed mirroring the existing Google Reserve pattern. Draft PR if API creds not yet provisioned.

## Phase 5 — Admin polish

- [ ] **Day 21 · block-list** — `blocked` (bool) + `block_reason` (text) on guests. Server-side reject on booking with code `GUEST_BLOCKED`. UI to block/unblock from guest profile (admin/manager only).
- [ ] **Day 22 · bulk-import** — CSV upload on the Guests page. Dedupe by normalized phone. Dry-run preview with row-level status (new / matched / skipped / error).
- [ ] **Day 23 · multi-location-reporting** — Reports page gains an "All locations" rollup across locations the user has access to, with a location filter.
