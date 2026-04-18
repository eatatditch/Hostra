import { z } from "zod";

export const paymentTypeEnum = z.enum([
  "deposit",
  "no_show_fee",
  "cancellation_fee",
  "other",
]);

export const createPaymentIntentSchema = z.object({
  guestId: z.string().min(1),
  reservationId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default("usd"),
  type: paymentTypeEnum.default("deposit"),
  captureMethod: z.enum(["automatic", "manual"]).default("manual"),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const capturePaymentSchema = z.object({
  paymentId: z.string().min(1),
  amountCents: z.number().int().positive().optional(),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1),
  amountCents: z.number().int().positive().optional(),
  reason: z
    .enum(["duplicate", "fraudulent", "requested_by_customer"])
    .optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type PaymentType = z.infer<typeof paymentTypeEnum>;
