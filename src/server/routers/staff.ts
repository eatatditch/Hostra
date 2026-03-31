import { z } from "zod";
import { router, protectedProcedure, roleProcedure } from "@/lib/trpc/init";
import { supabase } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

// Separate admin client for auth operations
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

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
      const adminClient = getAdminClient();

      // Check if staff record already exists for this email
      const { data: existingStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("email", input.email)
        .limit(1);

      if (existingStaff && existingStaff.length > 0) {
        throw new Error("A staff account with this email already exists");
      }

      // Try to create auth user
      let authUserId: string;
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

      if (authError) {
        // If user already exists in auth (orphan from previous attempt), find them
        if (authError.message.includes("already") || authError.message.includes("exists")) {
          const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 100 });
          const existing = userList?.users?.find((u) => u.email === input.email);
          if (existing) {
            // Update their password
            await adminClient.auth.admin.updateUserById(existing.id, { password: input.password });
            authUserId = existing.id;
          } else {
            throw new Error(`Auth error: ${authError.message}`);
          }
        } else {
          throw new Error(`Auth error: ${authError.message}`);
        }
      } else if (!authData.user) {
        throw new Error("Failed to create auth user");
      } else {
        authUserId = authData.user.id;
      }

      // Create staff record
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .insert({
          auth_user_id: authUserId,
          email: input.email,
          name: input.name,
          role: input.role,
          location_id: input.locationId,
        })
        .select()
        .single();

      if (staffError) {
        throw new Error(`Staff error: ${staffError.message}`);
      }

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
      const { data: staffRecord } = await supabase
        .from("staff")
        .select("auth_user_id")
        .eq("id", input.staffId)
        .single();

      if (!staffRecord) throw new Error("NOT_FOUND");

      const adminClient = getAdminClient();
      const { error } = await adminClient.auth.admin.updateUserById(
        staffRecord.auth_user_id,
        { password: input.newPassword }
      );

      if (error) throw new Error(error.message);
      return { success: true };
    }),
});
