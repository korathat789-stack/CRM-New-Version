import { cache } from "react";
import { createClient } from "./supabase/server";
import { isRole, type Role } from "./roles";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  status: "active" | "inactive";
}

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

/**
 * Resolve the signed-in user and their role from the `profiles` table.
 * Returns null when not authenticated.
 *
 * Dev fallback: if Supabase env vars are absent the app runs without auth, so
 * we surface an in-memory "admin" so menus and pages are explorable locally.
 * This NEVER applies once Supabase is configured.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) {
    return {
      id: "dev",
      email: "dev@local",
      fullName: "Dev (no auth)",
      role: "admin",
      status: "active",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: isRole(profile?.role) ? profile.role : "sales",
    status: profile?.status === "inactive" ? "inactive" : "active",
  };
});

/** Throw if the current user's role is not allowed — for use in Server Actions. */
export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");
  if (!allowed.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
