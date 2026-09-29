# Security notes

What protects the public demo, what does not, and what to change before it is anything more than a demo.
Audited September 2026.

## The demo

With no `.env.local` the app holds no secrets and calls no outside service: people, postings and the
sample student are bundled, and each visitor's answers live in that visitor's own cookies
(`httpOnly`, `sameSite=lax`, `secure` in production). Nothing a visitor types reaches a server-side
store.

## Secrets

- No secret is in the repo or its history. `.env*` is gitignored except `.env.example`, which holds
  names only.
- `.githooks/pre-commit` blocks a commit that adds a token. `npm install` activates it in every clone
  (`prepare` sets `core.hooksPath`); `databricks/scripts/setup.sh` does the same.
- In the full version the runtime secrets are `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID` and
  `DATABRICKS_TOKEN`, set as host environment variables. Nothing is exposed under `NEXT_PUBLIC_`
  except the Supabase anon key, which is public by design.

## The full version on a public URL

- A visitor can upload a PDF (type and 15 MB checked before any byte is read) and have it read by
  `ai_query`, and can run the plan agent. Both are rate-limited per browser and per server instance
  (`src/lib/limit.ts`: 6 resume reads and 8 agent runs per ten minutes per session; 40 and 60 per
  instance). A shared limiter is the upgrade for real traffic.
- `workspace.jobsearch.demo_sessions` and `agent_runs` keep what a visitor leaves behind, keyed by a
  random cookie id; no name, email or password is asked for and the PDF is never stored. A scheduled
  job should delete sessions after 14 days and runs after 30.

## Application

- Every warehouse statement is parameterised (`:name` bindings via the Statement Execution API); table names
  are constants. No SQL is built from user input.
- The demo cookie is `httpOnly`, `sameSite=lax`, `secure` in production, random UUID, 30 days.
- The cron endpoint requires `CRON_SECRET` with a constant-time compare and is inert without it.
- Response headers: `nosniff`, `X-Frame-Options: DENY`, strict referrer policy, a locked-down
  `Permissions-Policy`, HSTS; `X-Powered-By` off.
- Model output is rendered as text (no `dangerouslySetInnerHTML`, no markdown renderer). Every extracted
  profile is validated with zod before it is stored or ranked.
- `npm audit --omit=dev`: 0 vulnerabilities at the time of the audit.

## Not done, and why

- **No Content-Security-Policy.** Next's bootstrap scripts are inline; a real CSP needs a per-request nonce
  threaded through the app shell. Worth doing before any non-demo use.
- **No sign-in on the demo.** By design: a browser is a student. Supabase auth exists in the code and turns on
  with `NEXT_PUBLIC_SUPABASE_*`; the demo does not use it.
- **Per-instance rate limits** (see above).
- **Synthetic people only.** The pool is generated; there is no scraping and no real person's data in the
  warehouse besides what a visitor uploads about themselves.
