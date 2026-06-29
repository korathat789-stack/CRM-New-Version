"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";

export interface UserActionResult {
  ok: boolean;
  error?: string;
}

/** Update a user's role / status / name. Admin only (RLS + guard trigger also
 *  enforce this; we run as the admin's session so the role change is allowed). */
export async function updateUser(
  id: string,
  values: { full_name: string; role: string; status: string }
): Promise<UserActionResult> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!isRole(values.role)) return { ok: false, error: "invalid" };
  const status = values.status === "inactive" ? "inactive" : "active";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: values.full_name.trim() || null,
      role: values.role as Role,
      status,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  return { ok: true };
}

/** Invite a new user by email (requires the service role key) and set role. */
export async function inviteUser(values: {
  email: string;
  full_name: string;
  role: string;
}): Promise<UserActionResult> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!values.email.trim()) return { ok: false, error: "emailRequired" };
  if (!isRole(values.role)) return { ok: false, error: "invalid" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "serviceRole" };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    values.email.trim(),
    { data: { full_name: values.full_name.trim() } }
  );
  if (error || !data.user) return { ok: false, error: error?.message ?? "inviteFailed" };

  // The handle_new_user trigger created the profile; set the chosen role/name
  // via the admin's session so the privilege guard permits the role change.
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      full_name: values.full_name.trim() || values.email.trim(),
      role: values.role as Role,
    })
    .eq("id", data.user.id);

  revalidatePath("/settings/users");
  return { ok: true };
}

/** Delete a user (requires the service role key). Cannot delete yourself. */
export async function deleteUser(id: string): Promise<UserActionResult> {
  let me;
  try {
    me = await requireRole(["admin"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (me.id === id) return { ok: false, error: "self" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "serviceRole" };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function getMyId(): Promise<string | null> {
  const me = await getCurrentUser();
  return me?.id ?? null;
}
