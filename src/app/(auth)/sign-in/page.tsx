import { AuthForm } from "../auth-form";
import { signIn } from "../actions";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/safe-path";

export default async function SignInPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  // Demo mode: nothing to sign in to. Straight through.
  if (!isSupabaseConfigured()) redirect(safeNext(next, "/dashboard"));
  return <AuthForm mode="sign-in" action={signIn} next={safeNext(next, "/dashboard")} reason={reason} />;
}
