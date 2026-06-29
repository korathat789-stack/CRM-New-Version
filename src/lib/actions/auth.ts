"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const isConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

export async function signInWithPassword(formData: FormData) {
  if (!isConfigured()) {
    redirect(`/login?error=notConfigured`);
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid`);
  }
  redirect(next || "/dashboard");
}

export async function signOut() {
  if (isConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
