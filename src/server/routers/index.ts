import { router } from "@/lib/trpc/init";
import { reservationRouter } from "./reservation";
import { waitlistRouter } from "./waitlist";
import { guestRouter } from "./guest";
import { triggerRouter } from "./trigger";
import { tableRouter } from "./table";
import { analyticsRouter } from "./analytics";

export const appRouter = router({
  reservation: reservationRouter,
  waitlist: waitlistRouter,
  guest: guestRouter,
  trigger: triggerRouter,
  table: tableRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
