import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getSession, type StaffSession } from "@/lib/auth/session";
import type { StaffRole } from "@/types";

export interface TRPCContext {
  session: StaffSession | null;
}

export async function createContext(): Promise<TRPCContext> {
  const session = await getSession();
  return { session };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { session: ctx.session } });
});

export function roleProcedure(...roles: StaffRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!roles.includes(ctx.session.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}
