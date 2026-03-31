import { z } from "zod";
import { router, publicProcedure, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";

export const tableRouter = router({
  getByLocation: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
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
        tableId: z.string().min(1),
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
        locationId: z.string().min(1),
        floorPlanId: z.string().min(1),
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
        tableId: z.string().min(1),
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
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*, tables:tables(*)")
        .eq("location_id", input.locationId)
        .eq("active", true);

      if (error) throw new Error(error.message);

      return data || [];
    }),

  createFloorPlan: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().min(1),
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
    .input(z.object({ locationId: z.string().min(1) }))
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

  createLocation: roleProcedure("admin")
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100),
        address: z.string().optional(),
        phone: z.string().optional(),
        timezone: z.string().default("America/New_York"),
      })
    )
    .mutation(async ({ input }) => {
      // Create location
      const { data: location, error } = await supabase
        .from("locations")
        .insert({
          name: input.name,
          slug: input.slug,
          address: input.address || null,
          phone: input.phone || null,
          timezone: input.timezone,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Create a default floor plan
      await supabase.from("floor_plans").insert({
        location_id: location.id,
        name: "Main Floor",
      });

      return location;
    }),

  updateLocation: roleProcedure("admin")
    .input(
      z.object({
        locationId: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { locationId, ...updateData } = input;
      const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updateData.name !== undefined) mapped.name = updateData.name;
      if (updateData.address !== undefined) mapped.address = updateData.address || null;
      if (updateData.phone !== undefined) mapped.phone = updateData.phone || null;
      if (updateData.timezone !== undefined) mapped.timezone = updateData.timezone;

      const { data, error } = await supabase
        .from("locations")
        .update(mapped)
        .eq("id", locationId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  deactivateLocation: roleProcedure("admin")
    .input(z.object({ locationId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("locations")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", input.locationId);

      if (error) throw new Error(error.message);
      return { deactivated: true };
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

  // Service Shifts
  getShifts: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("service_shifts")
        .select("*")
        .eq("location_id", input.locationId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    }),

  createShift: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().min(1),
        name: z.string().min(1).max(100),
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        maxCovers: z.number().int().min(1),
        slotDurationMin: z.number().int().min(15).default(30),
      })
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("service_shifts")
        .insert({
          location_id: input.locationId,
          name: input.name,
          day_of_week: input.dayOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
          max_covers: input.maxCovers,
          slot_duration_min: input.slotDurationMin,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  updateShift: roleProcedure("admin", "manager")
    .input(
      z.object({
        shiftId: z.string().min(1),
        name: z.string().min(1).max(100).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        maxCovers: z.number().int().min(1).optional(),
        slotDurationMin: z.number().int().min(15).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { shiftId, ...updateData } = input;
      const mapped: Record<string, unknown> = {};
      if (updateData.name !== undefined) mapped.name = updateData.name;
      if (updateData.startTime !== undefined) mapped.start_time = updateData.startTime;
      if (updateData.endTime !== undefined) mapped.end_time = updateData.endTime;
      if (updateData.maxCovers !== undefined) mapped.max_covers = updateData.maxCovers;
      if (updateData.slotDurationMin !== undefined) mapped.slot_duration_min = updateData.slotDurationMin;
      if (updateData.active !== undefined) mapped.active = updateData.active;

      const { data, error } = await supabase
        .from("service_shifts")
        .update(mapped)
        .eq("id", shiftId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  deleteShift: roleProcedure("admin", "manager")
    .input(z.object({ shiftId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("service_shifts")
        .delete()
        .eq("id", input.shiftId);

      if (error) throw new Error(error.message);
      return { deleted: true };
    }),
});
