import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { db } from "@/lib/db";
import { tables, floorPlans, locations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const tableRouter = router({
  getByLocation: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.tables.findMany({
        where: and(
          eq(tables.locationId, input.locationId),
          eq(tables.active, true)
        ),
        orderBy: (t, { asc }) => [asc(t.label)],
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        status: z.enum(["available", "reserved", "occupied", "turning"]),
      })
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(tables)
        .set({ status: input.status })
        .where(eq(tables.id, input.tableId))
        .returning();
      return updated;
    }),

  create: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().uuid(),
        floorPlanId: z.string().uuid(),
        label: z.string().min(1).max(20),
        capacity: z.number().int().min(1).max(50),
        minCapacity: z.number().int().min(1).default(1),
        positionX: z.number().default(0),
        positionY: z.number().default(0),
        combinable: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const [table] = await db.insert(tables).values(input).returning();
      return table;
    }),

  update: roleProcedure("admin", "manager")
    .input(
      z.object({
        tableId: z.string().uuid(),
        label: z.string().min(1).max(20).optional(),
        capacity: z.number().int().min(1).max(50).optional(),
        minCapacity: z.number().int().min(1).optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        combinable: z.boolean().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { tableId, ...data } = input;
      const [updated] = await db
        .update(tables)
        .set(data)
        .where(eq(tables.id, tableId))
        .returning();
      return updated;
    }),

  getFloorPlans: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.floorPlans.findMany({
        where: and(
          eq(floorPlans.locationId, input.locationId),
          eq(floorPlans.active, true)
        ),
        with: {
          tables: {
            where: eq(tables.active, true),
          },
        },
      });
    }),

  createFloorPlan: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const [fp] = await db.insert(floorPlans).values(input).returning();
      return fp;
    }),

  getLocation: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.locations.findFirst({
        where: eq(locations.id, input.locationId),
      });
    }),

  getLocations: protectedProcedure.query(async () => {
    return db.query.locations.findMany({
      where: eq(locations.active, true),
    });
  }),
});
