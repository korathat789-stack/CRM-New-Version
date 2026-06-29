import { createClient } from "./supabase/server";
import type { Role } from "./roles";

export interface AppUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  status: "active" | "inactive";
  last_login_at: string | null;
  created_at: string;
}

export async function listUsers(): Promise<AppUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, last_login_at, created_at")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
