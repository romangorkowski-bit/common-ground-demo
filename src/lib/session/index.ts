import { cookies } from "next/headers";
import {
  AffinityFactsSchema, EMPTY_FACTS, FactsMetaSchema,
  type AffinityFacts, type FactsMeta, type StudentProfile,
} from "@/lib/ai/schemas";
import { DEFAULT_WEIGHTS, HomophilyWeightsSchema, type HomophilyWeights } from "@/lib/homophily/scorer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE } from "./cookie";
import { demoStore, type StoredStudent } from "./demo-store";

export type { StoredStudent };

export interface Session {
  /** Null when nobody is signed in. In demo mode, null only before the proxy has run. */
  student: StoredStudent | null;
  demo: boolean;
}

/** Demo mode's "who is this": the browser id in the cookie, if any. */
export async function demoAccountId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEMO_COOKIE)?.value ?? null;
}

/**
 * The one place the rest of the app asks "who is this and what do we know
 * about them". Everything downstream consumes StoredStudent and does not care
 * whether it came from Postgres or from memory.
 */
export async function getSession(): Promise<Session> {
  if (!isSupabaseConfigured()) {
    return { student: await demoStore.load(await demoAccountId()), demo: true };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { student: null, demo: false };

  const [{ data: profileRow }, { data: studentRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("student_profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
  ]);

  const profile: StudentProfile = {
    full_name: profileRow?.full_name ?? null,
    school: profileRow?.school ?? null,
    grad_date: profileRow?.grad_date ?? null,
    work_auth: profileRow?.work_auth ?? null,
    skills: studentRow?.skills ?? [],
    coursework: studentRow?.coursework ?? [],
    experience: studentRow?.experience ?? [],
    projects: studentRow?.projects ?? [],
    targets: studentRow?.targets ?? { roles: [], locations: [], industries: [] },
    affinity: studentRow?.resume_affinity ?? {
      school_raw: profileRow?.school ?? null, majors: [], minors: [], student_orgs: [],
      greek: [], case_competitions: [], programs: [], prior_employers: [],
      clients_and_programs: [], certifications_in_progress: [],
    },
    uncertainties: studentRow?.uncertainties ?? [],
  };

  // Parsed at the boundary, like every other jsonb column in this schema: a
  // row written by an older version of the field registry should degrade to
  // defaults, not crash a page.
  const facts = safeParse(AffinityFactsSchema, { ...EMPTY_FACTS, ...(studentRow?.affinity_facts ?? {}) }, EMPTY_FACTS);
  const meta = safeParse(FactsMetaSchema, studentRow?.affinity_facts_meta ?? {}, {} as FactsMeta);
  const homophilyWeights = safeParse(HomophilyWeightsSchema, studentRow?.homophily_weights ?? DEFAULT_WEIGHTS, DEFAULT_WEIGHTS);

  return {
    demo: false,
    student: {
      profile, facts, meta,
      intakeCompletedAt: studentRow?.intake_completed_at ?? null,
      email: auth.user.email ?? null,
      homophilyWeights,
    },
  };
}

/**
 * Writes the questionnaire's output. `completed` only ever sets the
 * completion stamp — it never clears one, so saving a company choice from the
 * dashboard cannot un-finish the questionnaire.
 */
export async function saveFacts(facts: AffinityFacts, meta: FactsMeta, completed = false): Promise<void> {
  if (!isSupabaseConfigured()) {
    const id = await demoAccountId();
    if (!id) throw new Error("Not signed in");
    await demoStore.save(id, { facts, meta, ...(completed ? { intakeCompletedAt: new Date().toISOString() } : {}) });
    return;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  await supabase.from("student_profiles").upsert({
    user_id: auth.user.id,
    affinity_facts: facts,
    affinity_facts_meta: meta,
    ...(completed ? { intake_completed_at: new Date().toISOString() } : {}),
  }, { onConflict: "user_id" });
}

function safeParse<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T } }, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success && result.data !== undefined ? result.data : fallback;
}

/** The student's homophily weights. Validated here so a bad form post cannot store garbage. */
export async function saveHomophilyWeights(weights: HomophilyWeights): Promise<void> {
  const parsed = HomophilyWeightsSchema.parse(weights);
  if (!isSupabaseConfigured()) {
    const id = await demoAccountId();
    if (!id) throw new Error("Not signed in");
    await demoStore.save(id, { homophilyWeights: parsed });
    return;
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  await supabase.from("student_profiles").upsert(
    { user_id: auth.user.id, homophily_weights: parsed }, { onConflict: "user_id" });
}
