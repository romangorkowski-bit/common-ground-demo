/**
 * Shared between proxy.ts and the session module, so it must stay free of
 * Node-only imports.
 */

/** Demo mode's identity cookie: a random id that owns one in-memory student. */
export const DEMO_COOKIE = "cg_demo";

/** Routes that need an account when Supabase is configured. */
export const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/intake", "/jobs", "/people", "/profile"] as const;

export const isProtectedPath = (path: string): boolean =>
  PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
