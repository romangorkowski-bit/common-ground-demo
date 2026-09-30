import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { mockPositionsProvider } from "@/lib/positions/mock";
import { tailorContext } from "./context";
import { SKILL_NAMES, TRUTH_RULES, skillGuide, tailorSystemPrompt } from "./skills";

test("the prompt carries all four guides verbatim, in working order", () => {
  const prompt = tailorSystemPrompt();
  const at = SKILL_NAMES.map((n) => prompt.indexOf(`<guide name="${n}">`));
  assert.ok(at.every((i) => i >= 0), "every guide is present");
  assert.deepEqual([...at].sort((a, b) => a - b), at, "analyze, tailor, bullets, format");
  for (const n of SKILL_NAMES) assert.ok(prompt.includes(skillGuide(n).trim()), `${n} is verbatim`);
});

test("the truth rules come last, so they override the guides", () => {
  const prompt = tailorSystemPrompt();
  assert.ok(prompt.trimEnd().endsWith(TRUTH_RULES.trimEnd()));
  assert.ok(prompt.lastIndexOf("</guide>") < prompt.indexOf("RULES THAT OVERRIDE"));
  // The one guide passage this app refuses: estimating a number.
  assert.match(skillGuide("resume-bullet-writer"), /When You Don't Have Exact Numbers/);
  assert.match(TRUTH_RULES, /overrides the bullet-writer guide's\s+"When You Don't Have Exact Numbers"/);
});

test("the model sees bullet refs and the student's answers", async () => {
  const [position] = await mockPositionsProvider.getPositions({ companies: [], limit: 1 });
  const bullet = student.profile.experience[0].bullets[0];
  const text = tailorContext({
    profile: student.profile, position,
    metrics: { "exp:0:0": { value: "1,200", unit: "survey responses", bullet, answeredAt: "" } },
  });
  assert.match(text, new RegExp(`exp:0:0 .*${bullet}`));
  assert.match(text, /METRIC ANSWERS:\nexp:0:0: 1,200 survey responses/);
});
