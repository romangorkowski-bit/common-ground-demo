import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { UnreadablePdfError, pdfToText } from "./pdf-text";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)));

test("a text-based resume flattens to the text ai_query needs", async () => {
  const text = await pdfToText(new Uint8Array(await fixture("sample-resume.pdf")));
  assert.match(text, /Sam Rivera/);
  assert.match(text, /Virginia Tech/);
  assert.match(text, /Delta Sigma Pi/);
  assert.ok(!/\n{3,}/.test(text), "runs of blank lines should be collapsed");
});

test("a PDF with no text layer is refused, not read as blank", async () => {
  // A scan would otherwise reach the model as an empty prompt and come back
  // as a confidently empty profile.
  const bytes = new Uint8Array(await fixture("no-text.pdf"));
  await assert.rejects(
    () => pdfToText(bytes),
    (e: unknown) => e instanceof UnreadablePdfError && /scan|could not be opened/i.test((e as Error).message),
  );
});

test("bytes that are not a PDF are refused", async () => {
  await assert.rejects(
    () => pdfToText(new TextEncoder().encode("this is not a pdf")),
    UnreadablePdfError,
  );
});
