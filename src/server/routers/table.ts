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
        shape: z.enum(["auto", "circle", "square", "rectangle"]).default("auto"),
        rotation: z.number().int().min(0).max(359).default(0),
        sizeMultiplier: z.number().min(0.5).max(3).default(1),
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
          shape: input.shape,
          rotation: input.rotation,
          size_multiplier: input.sizeMultiplier,
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
        shape: z.enum(["auto", "circle", "square", "rectangle"]).optional(),
        rotation: z.number().int().min(0).max(359).optional(),
        sizeMultiplier: z.number().min(0.5).max(3).optional(),
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
      if (data.shape !== undefined) updateData.shape = data.shape;
      if (data.rotation !== undefined) updateData.rotation = data.rotation;
      if (data.sizeMultiplier !== undefined) updateData.size_multiplier = data.sizeMultiplier;

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

  updateFloorPlanLabels: roleProcedure("admin", "manager")
    .input(
      z.object({
        floorPlanId: z.string().min(1),
        labels: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            x: z.number(),
            y: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from("floor_plans")
        .update({ labels: input.labels })
        .eq("id", input.floorPlanId);

      if (error) throw new Error(error.message);
      return { success: true };
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
        pacingCapPerSlot: z.number().int().min(1).max(10000).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { locationId, ...updateData } = input;
      const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updateData.name !== undefined) mapped.name = updateData.name;
      if (updateData.address !== undefined) mapped.address = updateData.address || null;
      if (updateData.phone !== undefined) mapped.phone = updateData.phone || null;
      if (updateData.timezone !== undefined) mapped.timezone = updateData.timezone;
      if (updateData.pacingCapPerSlot !== undefined) mapped.pacing_cap_per_slot = updateData.pacingCapPerSlot;

      const { data, error } = await supabase
        .from("locations")
        .update(mapped)
        .eq("id", locationId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Reservation settings (per-location): pacing cap per slot.
  // Manager+ can edit pacing; admin retains full updateLocation.
  updateReservationSettings: roleProcedure("admin", "manager")
    .input(
      z.object({
        locationId: z.string().min(1),
        pacingCapPerSlot: z.number().int().min(1).max(10000).nullable().optional(),
        depositAmountCents: z.number().int().min(0).max(10000000).nullable().optional(),
        depositMinPartySize: z.number().int().min(1).max(50).nullable().optional(),
        maxBookingPartySize: z.number().int().min(1).max(500).nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.pacingCapPerSlot !== undefined) {
        patch.pacing_cap_per_slot = input.pacingCapPerSlot;
      }
      if (input.depositAmountCents !== undefined) {
        patch.deposit_amount_cents = input.depositAmountCents;
      }
      if (input.depositMinPartySize !== undefined) {
        patch.deposit_min_party_size = input.depositMinPartySize;
      }
      if (input.maxBookingPartySize !== undefined) {
        patch.max_booking_party_size = input.maxBookingPartySize;
      }

      const { data, error } = await supabase
        .from("locations")
        .update(patch)
        .eq("id", input.locationId)
        .select(
          "id, pacing_cap_per_slot, deposit_amount_cents, deposit_min_party_size, max_booking_party_size"
        )
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
      .select("id, name, slug, address, phone, max_booking_party_size")
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

  getBrandSettings: publicProcedure.query(async () => {
    const { data, error } = await supabase
      .from("brand_settings")
      .select("*")
      .limit(1)
      .single();
    if (error) return { brand_name: "Ditch", logo_url: null, website_url: null, platform_logo_url: null };
    return data;
  }),

  updatePlatformLogo: protectedProcedure
    .input(z.object({ platformLogoUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Check platform admin
      const { data: staff } = await supabase.from("staff").select("is_platform_admin").eq("id", ctx.session.id).single();
      if (!staff?.is_platform_admin) throw new Error("Only platform admins can update the HostOS logo");

      const { data: existing } = await supabase.from("brand_settings").select("id").limit(1).single();
      if (existing) {
        const { data, error } = await supabase.from("brand_settings")
          .update({ platform_logo_url: input.platformLogoUrl || null, updated_at: new Date().toISOString() })
          .eq("id", existing.id).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      return null;
    }),

  updateAppIcon: protectedProcedure
    .input(z.object({ appIconUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { data: staff } = await supabase.from("staff").select("is_platform_admin").eq("id", ctx.session.id).single();
      if (!staff?.is_platform_admin) throw new Error("Only platform admins can update the app icon");

      const { data: existing } = await supabase.from("brand_settings").select("id").limit(1).single();
      if (existing) {
        const { data, error } = await supabase.from("brand_settings")
          .update({ app_icon_url: input.appIconUrl || null, updated_at: new Date().toISOString() })
          .eq("id", existing.id).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      return null;
    }),

  updateBrandSettings: roleProcedure("admin")
    .input(z.object({
      brandName: z.string().min(1).max(255).optional(),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.brandName !== undefined) mapped.brand_name = input.brandName;
      if (input.logoUrl !== undefined) mapped.logo_url = input.logoUrl || null;
      if (input.websiteUrl !== undefined) mapped.website_url = input.websiteUrl || null;

      // Update first record
      const { data: existing } = await supabase.from("brand_settings").select("id").limit(1).single();
      if (existing) {
        const { data, error } = await supabase.from("brand_settings").update(mapped).eq("id", existing.id).select().single();
        if (error) throw new Error(error.message);
        return data;
      }
      return null;
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

  // Hosts can toggle shift active/inactive (for calendar blocking)
  toggleShiftActive: protectedProcedure
    .input(z.object({ shiftId: z.string().min(1), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("service_shifts")
        .update({ active: input.active })
        .eq("id", input.shiftId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Hosts can block/unblock dates
  blockDate: protectedProcedure
    .input(z.object({ locationId: z.string().min(1), date: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await supabase
        .from("blocked_dates")
        .upsert(
          { location_id: input.locationId, date: input.date, reason: input.reason || null, created_by: ctx.session.id },
          { onConflict: "location_id,date" }
        );
      if (error) throw new Error(error.message);
      return { blocked: true };
    }),

  unblockDate: protectedProcedure
    .input(z.object({ locationId: z.string().min(1), date: z.string() }))
    .mutation(async ({ input }) => {
      await supabase.from("blocked_dates").delete().eq("location_id", input.locationId).eq("date", input.date);
      return { unblocked: true };
    }),
});
