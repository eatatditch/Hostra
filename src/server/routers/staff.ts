import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/auth/supabase-server";

export const staffRouter = router({
  list: roleProcedure("admin")
    .query(async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("*, location:locations(id, name)")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    }),

  create: roleProcedure("admin")
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).max(255),
        role: z.enum(["admin", "manager", "host"]),
        locationId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Create auth user via Supabase Admin API
      const adminClient = await createSupabaseAdmin();
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

      if (authError) throw new Error(authError.message);

      // Create staff record
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .insert({
          auth_user_id: authUser.user.id,
          email: input.email,
          name: input.name,
          role: input.role,
          location_id: input.locationId,
        })
        .select()
        .single();

      if (staffError) throw new Error(staffError.message);

      return staffRecord;
    }),

  update: roleProcedure("admin")
    .input(
      z.object({
        staffId: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        role: z.enum(["admin", "manager", "host"]).optional(),
        locationId: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { staffId, ...updateData } = input;
      const mapped: Record<string, unknown> = {};
      if (updateData.name !== undefined) mapped.name = updateData.name;
      if (updateData.role !== undefined) mapped.role = updateData.role;
      if (updateData.locationId !== undefined) mapped.location_id = updateData.locationId;
      if (updateData.active !== undefined) mapped.active = updateData.active;

      const { data, error } = await supabase
        .from("staff")
        .update(mapped)
        .eq("id", staffId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  resetPassword: roleProcedure("admin")
    .input(
      z.object({
        staffId: z.string().min(1),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      // Get the auth user id
      const { data: staffRecord } = await supabase
        .from("staff")
        .select("auth_user_id")
        .eq("id", input.staffId)
        .single();

      if (!staffRecord) throw new Error("NOT_FOUND");

      const adminClient = await createSupabaseAdmin();
      const { error } = await adminClient.auth.admin.updateUserById(
        staffRecord.auth_user_id,
        { password: input.newPassword }
      );

      if (error) throw new Error(error.message);
      return { success: true };
    }),
});
