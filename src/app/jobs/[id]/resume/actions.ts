"use server";

import { AGENT_LIMIT, allow } from "@/lib/limit";
import { demoAccountId, getSession, saveFacts } from "@/lib/session";
import { tailorForPosting, tailorMode, type TailorOutcome } from "@/lib/tailor";
import { findPosition } from "@/lib/tailor/lookup";
import { answersOf, bulletRefs, liveMetrics, type Answer } from "@/lib/tailor/refs";

export interface TailorState {
  outcome: TailorOutcome | null;
  answers: Answer[];
  error: string | null;
}

/**
 * One action for the workspace's three buttons: tailor, add a number to a
 * bullet, forget a number. Every path ends in a fresh tailor, so the page
 * always shows the resume that matches what is saved.
 */
export async function tailorAction(prev: TailorState, formData: FormData): Promise<TailorState> {
  const intent = String(formData.get("intent") ?? "tailor");
  const positionId = String(formData.get("position") ?? "");
  const { student, demo } = await getSession();
  if (!student) return { ...prev, error: "Sign in first." };

  const { position } = await findPosition(student, positionId);
  if (!position) return { ...prev, error: "That opening is no longer listed." };

  const mode = tailorMode();
  const who = student.email ?? (await demoAccountId()) ?? "anonymous";
  if (mode !== "rules" && !allow("agent", who, AGENT_LIMIT)) {
    return { ...prev, error: "That is a lot of rewrites in ten minutes. Give it a few and try again." };
  }

  let facts = student.facts;
  if (intent === "metric" || intent === "forget") {
    const ref = String(formData.get("ref") ?? "");
    const line = bulletRefs(student.profile).find((b) => b.ref === ref);
    if (!line) return { ...prev, error: "That bullet is no longer on your profile." };
    const metrics = { ...liveMetrics(student.profile, facts.metrics) };
    if (intent === "metric") {
      const value = String(formData.get("value") ?? "").trim().slice(0, 40);
      const unit = String(formData.get("unit") ?? "").trim().slice(0, 40);
      if (!/\d/.test(value)) return { ...prev, error: "Give a number, like 1,200 or 30%. An honest rough count is fine." };
      metrics[ref] = { value, unit, bullet: line.text, answeredAt: new Date().toISOString() };
    } else {
      delete metrics[ref];
    }
    facts = { ...facts, metrics };
    await saveFacts(facts, student.meta);
  }

  try {
    const outcome = await tailorForPosting({ profile: student.profile, facts, position, email: demo ? null : student.email, mode });
    return { outcome, answers: answersOf(liveMetrics(student.profile, facts.metrics)), error: null };
  } catch (err) {
    console.error("[tailor] failed", err);
    return { ...prev, error: "The tailor could not finish. Nothing was lost; try again." };
  }
}
