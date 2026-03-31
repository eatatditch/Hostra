import { router } from "@/lib/trpc/init";
import { reservationRouter } from "./reservation";
import { waitlistRouter } from "./waitlist";
import { guestRouter } from "./guest";
import { triggerRouter } from "./trigger";
import { tableRouter } from "./table";
import { analyticsRouter } from "./analytics";
import { staffRouter } from "./staff";

export const appRouter = router({
  reservation: reservationRouter,
  waitlist: waitlistRouter,
  guest: guestRouter,
  trigger: triggerRouter,
  table: tableRouter,
  analytics: analyticsRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;
