import { createSupabaseServer } from "./supabase-server";
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
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, role, location_id")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .single();

  if (!staff) return null;

  return {
    id: staff.id,
    authUserId: user.id,
    email: user.email!,
    name: staff.name,
    role: staff.role as StaffRole,
    locationId: staff.location_id,
  };
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
