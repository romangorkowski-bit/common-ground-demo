/**
 * A `next` / `returnTo` value from a request, kept only if it is a path on
 * this site. Browsers read `//host` and `/\host` as another site, and some
 * treat a tab or newline inside a URL as nothing, so anything with a second
 * leading slash, a backslash or a control character is refused.
 */
export function safeNext(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/(?![/\\])/.test(s) && !/[\\\u0000-\u001f\u007f]/.test(s) ? s : fallback;
}
