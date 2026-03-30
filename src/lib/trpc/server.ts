import "server-only";
import { createCallerFactory, createContext } from "./init";
import { appRouter } from "@/server/routers";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const context = await createContext();
  return createCaller(context);
}
