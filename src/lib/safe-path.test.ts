import assert from "node:assert/strict";
import { test } from "vitest";
import { safeNext } from "./safe-path";

test("same-site paths pass through", () => {
  assert.equal(safeNext("/dashboard", "/x"), "/dashboard");
  assert.equal(safeNext("/jobs/m01?tab=1#top", "/x"), "/jobs/m01?tab=1#top");
});

test("anything a browser could read as another site falls back", () => {
  for (const bad of ["//evil.example.com", "/\\evil.example.com", "/\\/evil.example.com", "https://evil.example.com",
    "evil.example.com", "/\t/evil.example.com", "/\n/evil.example.com", "", null, undefined, 42]) {
    assert.equal(safeNext(bad, "/fallback"), "/fallback", String(bad));
  }
});
