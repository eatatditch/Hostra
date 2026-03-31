import { z } from "zod";
import { router, publicProcedure, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";

export const tableRouter = router({
  getByLocation: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("location_id", input.locationId)
        .eq("active", true)
        .order("label", { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        tableId: z.string().uuid(),
        status: z.enum(["available", "reserved", "occupied", "turning"]),
      })
    )
    .mutation(async ({ input }) => {
      const { data: updated, error } = await supabase
        .from("tables")
        .update({ status: input.status })
        .eq("id", input.tableId)
        .select()
        .single();

      if (error) throw new Error(error.message);
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
      const { data: table, error } = await supabase
        .from("tables")
        .insert({
          location_id: input.locationId,
          floor_plan_id: input.floorPlanId,
          label: input.label,
          capacity: input.capacity,
          min_capacity: input.minCapacity,
          position_x: input.positionX,
          position_y: input.positionY,
          combinable: input.combinable,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
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
      const updateData: Record<string, unknown> = {};
      if (data.label !== undefined) updateData.label = data.label;
      if (data.capacity !== undefined) updateData.capacity = data.capacity;
      if (data.minCapacity !== undefined) updateData.min_capacity = data.minCapacity;
      if (data.positionX !== undefined) updateData.position_x = data.positionX;
      if (data.positionY !== undefined) updateData.position_y = data.positionY;
      if (data.combinable !== undefined) updateData.combinable = data.combinable;
      if (data.active !== undefined) updateData.active = data.active;

      const { data: updated, error } = await supabase
        .from("tables")
        .update(updateData)
        .eq("id", tableId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }),

  getFloorPlans: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*, tables:tables(*)")
        .eq("location_id", input.locationId)
        .eq("active", true);

      if (error) throw new Error(error.message);

      // Filter tables to only active ones (client-side since nested filter not supported)
      return (data || []).map((fp) => ({
        ...fp,
        tables: (fp.tables || []).filter((t: { active: boolean }) => t.active),
      }));
    }),

  createFloorPlan: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().uuid(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const { data: fp, error } = await supabase
        .from("floor_plans")
        .insert({
          location_id: input.locationId,
          name: input.name,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return fp;
    }),

  getLocation: protectedProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", input.locationId)
        .single();

      if (error) return null;
      return data;
    }),

  getLocations: protectedProcedure.query(async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("active", true);

    if (error) throw new Error(error.message);
    return data;
  }),

  getPublicLocations: publicProcedure.query(async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, slug, address")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }),
});
