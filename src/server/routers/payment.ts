import { router, publicProcedure, protectedProcedure } from "@/lib/trpc/init";
import {
  createPaymentIntentSchema,
  capturePaymentSchema,
  refundPaymentSchema,
} from "@/lib/validators/payment";
import {
  createPaymentIntent,
  capturePayment,
  refundPayment,
} from "@/server/services/payment";

export const paymentRouter = router({
  createIntent: publicProcedure
    .input(createPaymentIntentSchema)
    .mutation(async ({ input }) => {
      return createPaymentIntent(input);
    }),

  capture: protectedProcedure
    .input(capturePaymentSchema)
    .mutation(async ({ input }) => {
      return capturePayment(input);
    }),

  refund: protectedProcedure
    .input(refundPaymentSchema)
    .mutation(async ({ input }) => {
      return refundPayment(input);
    }),
});
