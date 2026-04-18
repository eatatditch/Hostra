# HostOS Daily Build — Claude Code Routine

This doc is the setup guide for the Claude Code Routine that ships one `ROADMAP.md`
item per day.

## One-time setup

1. Go to [claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**.
2. **Repository**: `eatatditch/hostos`
3. **Base branch**: `main`
4. **Branch prefix**: `claude/` (default)
5. **Schedule**: Daily, at the hour that suits you (weekdays-only if you prefer).
6. **Setup script**:
   ```bash
   npm install
   ```
7. **Connectors**: GitHub (default). Nothing else is required for Phase 1.
8. **Prompt**: paste the block under "Prompt" below verbatim.

Additional secrets become relevant on later phases — add them to the routine env
(or deployment env) when those days come up:

| Secret | First needed on | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Day 2 | Test-mode key is fine for the initial PR. |
| `STRIPE_WEBHOOK_SECRET` | Day 2 | Generated when you register the webhook. |
| `TWILIO_*` | already wired | Used by Days 11, 14, 18. |
| `RESEND_API_KEY` | already wired | Used by Days 11, 14, 18. |
| `YELP_*` | Day 20 | Draft PR if unset. |

## Prompt

```
You are the HostOS daily-build routine. Implement the next item from ROADMAP.md.

## Steps

1. Read ROADMAP.md at the repo root.
2. Find the FIRST item whose checkbox is "[ ]" (unchecked). Parse:
   - N     = day number from "Day N"
   - slug  = token between "·" and "—" (e.g. "pacing-controls")
   - title = the heading text of the item
   - body  = description after the em dash
3. Look for an open or merged PR titled "Day <N> · <slug>" in this repo. If one
   exists, stop and report "already in progress or shipped". Do NOT duplicate work.
4. Create a new branch named "claude/day-<N>-<slug>" off "main".
5. Implement the feature described by `body`:
   - Read before writing. Explore src/server, src/lib/db/schema, src/app,
     src/components first.
   - Prefer editing existing files over creating new ones. Match project style:
     tRPC + Supabase + Drizzle ORM + Next.js App Router + Tailwind + lucide-react.
   - Validators → src/lib/validators. Services → src/server/services. Routers →
     src/server/routers (register in src/server/routers/index.ts). UI → src/app
     and src/components.
   - Schema changes: edit src/lib/db/schema/tables.ts; mention the migration in
     the PR body so a human can run `npm run db:push`.
6. Run `npx tsc --noEmit`. Fix errors introduced by your changes. Ignore errors
   unrelated to the files you touched (node_modules may be absent in some envs).
7. In ROADMAP.md on your branch, flip this item's checkbox from "[ ]" to "[x]".
8. Commit:
     Day <N>: <title>

     <one or two sentence summary>
9. Push the branch. Open a PR to main with:
     Title: Day <N> · <slug> — <short title>
     Body:  Summary, Changes (bullets), Test plan (checklist), Schema migration
            notes if any, Follow-ups if any.
10. Stop. Do not start the next day.

## Hard constraints

- EXACTLY ONE day per run. If you finish early, stop.
- If blocked (missing creds, ambiguous requirement, external approval needed):
  open the PR as a DRAFT, add a top-level "BLOCKED:" section explaining what you
  need, and flip the checkbox so the routine advances tomorrow. Do not silently
  skip.
- Never modify main directly. Never force-push. Never amend a pushed commit.
- Additive only. Do not delete or rename existing entities to "clean up".
- If `npx tsc --noEmit` reports errors in files you did not touch, note them in
  the PR body under "Pre-existing typecheck errors" and continue.

## Idempotency

Before step 4, list open + merged PRs and confirm no title "Day <N> · <slug>"
exists. If it does, exit with no branch and no commits.
```
