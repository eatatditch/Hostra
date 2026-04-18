import { router } from "@/lib/trpc/init";
import { reservationRouter } from "./reservation";
import { waitlistRouter } from "./waitlist";
import { guestRouter } from "./guest";
import { triggerRouter } from "./trigger";
import { tableRouter } from "./table";
import { analyticsRouter } from "./analytics";
import { staffRouter } from "./staff";
import { paymentRouter } from "./payment";

export const appRouter = router({
  reservation: reservationRouter,
  waitlist: waitlistRouter,
  guest: guestRouter,
  trigger: triggerRouter,
  table: tableRouter,
  analytics: analyticsRouter,
  staff: staffRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
