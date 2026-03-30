import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
  ssl: "prefer",
  idle_timeout: 20,
  max: 1,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
