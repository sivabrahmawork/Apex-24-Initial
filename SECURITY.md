# SECURITY.md — what is hardened, and what is honestly still open

## Shipped
- Rate limiting (middleware.ts): per-IP buckets — auth 10/min, AI 30/min, writes 60/min, reads 120/min.
- Security headers on every response: X-Frame-Options DENY, nosniff, Referrer-Policy,
  Permissions-Policy, HSTS.
- AuthN/AuthZ: Supabase-verified bearer on every write; persona-ownership check (requirePersona);
  editor role server-checked on every /api/admin route; publish/open gates re-verified server-side.
- SQL injection: all queries parameterized (drizzle sql`` tags); no string concatenation anywhere.
- Input validation: enum allow-lists, length caps (tweets 280, 5W 100 words, group title 60),
  option-index bounds on polls, label allow-list on tag correction.
- Secrets: service-role key server-only; anon key is the only browser-exposed credential;
  .env gitignored; Claude/Resend keys never reach the client.
- Abuse rails: report thresholds, Claude complaint review, audit-logged takedowns, fail-closed
  image screen (deferred media), verbatim-overlap guard on editorial content.

## Open (do these; no app is "hack-proof")
1. Supabase RLS: server uses a direct Postgres connection (bypasses RLS by design). Enable RLS
   with deny-all policies on all tables anyway, so the anon key alone can never read data if a
   client-side query path is ever added. (One-time SQL; do before public launch.)
2. MFA on the editor account the day Supabase MFA is enabled — highest-value account in the system.
3. Dependency hygiene: `npm audit` in CI; Dependabot on the repo.
4. CSP: add a Content-Security-Policy header after fonts/domains stabilize (breaks things if rushed).
5. Backups: enable Supabase PITR before real users; test one restore.
6. In-memory rate limits reset per instance/deploy — move to Upstash Redis if you scale past one region.
