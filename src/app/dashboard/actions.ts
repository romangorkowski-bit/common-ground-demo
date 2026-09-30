"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyInfo, sameCompany } from "@/lib/companies";
import { WEIGHT_LABELS, type HomophilyWeights } from "@/lib/homophily/scorer";
import { safeNext } from "@/lib/safe-path";
import { getSession, saveFacts, saveHomophilyWeights } from "@/lib/session";

const MAX_NAME = 80;

/**
 * The student picks a company to go after. It is remembered on their profile
 * (`target_companies`, which the openings scorer and the people providers
 * already read), and they land on that company's page.
 *
 * A company we have never heard of is fine: the name is kept as typed.
 */
export async function chooseCompany(formData: FormData): Promise<void> {
  const raw = String(formData.get("company") ?? "").trim().slice(0, MAX_NAME);
  if (!raw) redirect("/dashboard");

  const { student } = await getSession();
  if (!student) redirect("/sign-in?next=/dashboard");

  const chosen = student.facts.target_companies;
  const existing = chosen.find((c) => sameCompany(c, raw));
  const name = existing ?? companyInfo(raw).name;

  if (!existing) {
    await saveFacts({ ...student.facts, target_companies: [...chosen, name] }, student.meta);
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
  }
  redirect(`/dashboard/${companyInfo(name).slug}`);
}

/** Takes a company off the list. Nothing else about the profile changes. */
export async function dropCompany(formData: FormData): Promise<void> {
  const raw = String(formData.get("company") ?? "").trim();
  const { student } = await getSession();
  if (!student) redirect("/sign-in?next=/dashboard");

  const kept = student.facts.target_companies.filter((c) => !sameCompany(c, raw));
  if (kept.length !== student.facts.target_companies.length) {
    await saveFacts({ ...student.facts, target_companies: kept }, student.meta);
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
  }
  redirect("/dashboard");
}

/**
 * The student's own weights for the homophily scorer: how much a shared
 * employer, club, field, hometown or university should count. Whole numbers
 * from 0 to 100; anything else falls back to what was stored.
 */
export async function saveWeightsAction(formData: FormData): Promise<void> {
  const { student } = await getSession();
  if (!student) redirect("/sign-in?next=/dashboard");

  const next: HomophilyWeights = { ...student.homophilyWeights };
  for (const { key } of WEIGHT_LABELS) {
    const n = Number(formData.get(key));
    if (Number.isInteger(n) && n >= 0 && n <= 100) next[key] = n;
  }
  await saveHomophilyWeights(next);

  const returnTo = safeNext(formData.get("returnTo"), "/dashboard");
  revalidatePath(returnTo);
  redirect(returnTo);
}
