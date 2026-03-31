import { createSupabaseServer } from "./supabase-server";
import { supabase } from "@/lib/db";
import type { StaffRole } from "@/types";

export interface StaffSession {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: StaffRole;
  locationId: string;
}

export async function getSession(): Promise<StaffSession | null> {
  try {
    const supabaseAuth = await createSupabaseServer();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) return null;

    const { data: staffRecord, error } = await supabase
      .from("staff")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .single();

    if (error || !staffRecord) return null;

    return {
      id: staffRecord.id,
      authUserId: user.id,
      email: user.email!,
      name: staffRecord.name,
      role: staffRecord.role as StaffRole,
      locationId: staffRecord.location_id,
    };
  } catch {
    return null;
  }
}

export async function requireSession(
  allowedRoles?: StaffRole[]
): Promise<StaffSession> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}
