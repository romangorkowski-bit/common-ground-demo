"use server";

import { redirect } from "next/navigation";
import { UnreadablePdfError, getResumeProvider } from "@/lib/resume";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
import { RESUME_LIMIT, allow } from "@/lib/limit";
import { deriveAll } from "@/lib/intake/derive";
import { FIELDS } from "@/lib/intake/fields";
import { demoStore } from "@/lib/session/demo-store";
import { demoAccountId, getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface UploadState { error: string | null }

/**
 * Reads the resume once and keeps the result.
 *
 * The extraction is what makes the questionnaire short: every fact found here
 * is a question the student never sees. Anything the model was unsure about
 * lands in `uncertainties`, which routes straight to the question that
 * resolves it.
 */
export async function uploadResume(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first." };
  if (file.type !== "application/pdf") return { error: "It needs to be a PDF." };
  if (file.size > 15 * 1024 * 1024) return { error: "That file is over 15 MB." };
  const who = (await getSession()).student?.email ?? (await demoAccountId()) ?? "anonymous";
  if (!allow("resume", who, RESUME_LIMIT)) return { error: "That is a lot of uploads in ten minutes. Give it a few and try again." };

  // Checked before the bytes are read, so a resume is never taken from someone
  // when nothing can be done with it.
  const reader = getResumeProvider();
  if (!reader.isReady()) {
    return {
      error: `${reader.notReadyReason} The demo student is already loaded — continue to the questions to see the flow.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let profile;
  try {
    profile = await reader.extract({ bytes, filename: file.name });
  } catch (error) {
    console.error(`[onboarding] ${reader.name} extraction failed`, error);
    // A scan is the student's problem to fix and worth saying precisely;
    // anything else is ours, and they should not be handed a stack trace.
    if (error instanceof UnreadablePdfError) return { error: error.message };
    return {
      error: "We couldn't read that resume. Nothing was saved — try again, or continue with the demo student.",
    };
  }

  if (!isSupabaseConfigured()) {
    const id = await demoAccountId();
    if (!id) redirect("/onboarding/upload");
    // What the resume already told us counts for ranking right away; the
    // questionnaire still asks the student to confirm each of these, because
    // no meta entry is written here, so nothing is silently treated as answered.
    // A new resume is a new student: answers to the previous questionnaire
    // are cleared with it, or every question would count as answered and the
    // intake would open on "all caught up" for a profile it never asked about.
    const facts = { ...EMPTY_FACTS, ...deriveAll(FIELDS, profile) };
    await demoStore.save(id, { profile, facts, meta: {}, intakeCompletedAt: null });
    redirect("/onboarding/review");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in?reason=expired&next=/onboarding/upload");

  const storagePath = `${auth.user.id}/resume.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: true, contentType: "application/pdf" });
  if (uploadError) return { error: uploadError.message };

  await supabase.from("documents").upsert({
    user_id: auth.user.id, kind: "resume", storage_path: storagePath,
    filename: file.name, byte_size: file.size, parsed_at: new Date().toISOString(),
  }, { onConflict: "user_id,kind" });

  await supabase.from("student_profiles").upsert({
    user_id: auth.user.id,
    skills: profile.skills, coursework: profile.coursework,
    experience: profile.experience, projects: profile.projects,
    targets: profile.targets, resume_affinity: profile.affinity,
    uncertainties: profile.uncertainties,
  }, { onConflict: "user_id" });

  await supabase.from("profiles").upsert({
    user_id: auth.user.id, full_name: profile.full_name,
    school: profile.school, grad_date: profile.grad_date, work_auth: profile.work_auth,
  }, { onConflict: "user_id" });

  redirect("/onboarding/review");
}

/**
 * The demo's way in when no resume reader is configured: start from the
 * sample student, whose resume has already been read, and go to the review.
 */
export async function startWithSampleStudent(): Promise<void> {
  if (!isSupabaseConfigured()) {
    const id = await demoAccountId();
    if (!id) redirect("/onboarding/upload");
    await demoStore.restart(id);
  }
  redirect("/onboarding/review");
}

/** The confirmation gate: nothing downstream reads a profile the student hasn't seen. */
export async function confirmProfile(): Promise<void> {
  const { student } = await getSession();
  if (!student) redirect("/sign-in");

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("student_profiles")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("user_id", auth.user.id);
    }
  }
  redirect("/intake");
}
