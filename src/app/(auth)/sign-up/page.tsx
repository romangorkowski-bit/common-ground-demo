import { AuthForm } from "../auth-form";
import { signUp } from "../actions";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/safe-path";

export default async function SignUpPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  // Demo mode: nothing to sign in to. Straight through.
  if (!isSupabaseConfigured()) redirect(safeNext(next, "/onboarding/upload"));
  return <AuthForm mode="sign-up" action={signUp} next={safeNext(next, "/onboarding/upload")} reason={reason} />;
}
