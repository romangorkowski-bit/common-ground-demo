"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE } from "@/lib/session/cookie";

export interface AuthState {
  error: string | null;
  /** Not a failure: something happened that the student has to act on. */
  notice?: string | null;
}


async function authenticate(
  mode: "sign-in" | "sign-up",
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), mode === "sign-up" ? "/onboarding/upload" : "/dashboard");
  if (!email || !password) return { error: "Email and password are both needed." };
  if (password.length < 6) return { error: "Password needs at least six characters." };

  // Demo mode has no accounts to sign in to; the pages redirect before the
  // form is ever shown, so this only answers a stale form post.
  if (!isSupabaseConfigured()) redirect(next);

  const supabase = await createClient();

  if (mode === "sign-in") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    redirect(next);
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Supabase confirms addresses by default, and then hands back a user with
  // no session. Redirecting on that would bounce straight off the proxy and
  // land the student back here with nothing said — so say it.
  if (!data.session) {
    return {
      error: null,
      notice: `Check ${email} for a confirmation link. The account is not live until you open it.`,
    };
  }
  redirect(next);
}

export const signIn = authenticate.bind(null, "sign-in");
export const signUp = authenticate.bind(null, "sign-up");

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    // Demo mode: dropping the id is "start over" — the next visit gets a
    // fresh student.
    const jar = await cookies();
    jar.delete(DEMO_COOKIE);
  }
  redirect("/");
}
