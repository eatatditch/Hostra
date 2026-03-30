import { createSupabaseServer } from "./supabase-server";
import { db } from "@/lib/db";
import { staff } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Use Drizzle directly to bypass RLS
    const staffRecord = await db.query.staff.findFirst({
      where: and(
        eq(staff.authUserId, user.id),
        eq(staff.active, true)
      ),
    });

    if (!staffRecord) return null;

    return {
      id: staffRecord.id,
      authUserId: user.id,
      email: user.email!,
      name: staffRecord.name,
      role: staffRecord.role as StaffRole,
      locationId: staffRecord.locationId,
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
