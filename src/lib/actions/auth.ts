"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const isConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

// Only allow same-origin relative redirect targets (block open redirects like
// `next=https://attacker.example` or protocol-relative `//evil`).
function safeNext(next: string): string {
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function signInWithPassword(formData: FormData) {
  if (!isConfigured()) {
    redirect(`/login?error=notConfigured`);
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid`);
  }
  redirect(next);
}

export async function signOut() {
  if (isConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
