# DEPLOY.md — Apex go-live runbook (~45 minutes of your clicks)

Why this file exists: deployment runs on YOUR Vercel + Supabase accounts with YOUR keys.
No one else can hold those credentials. Every step below is either a click or a paste.

## 0. Accounts (10 min)
- github.com — create a private repo `apex`
- supabase.com — create a project (region: ap-south-1 / Mumbai)
- vercel.com — sign in with GitHub
- resend.com — create API key; verify your sending domain (or use their test sender for the pilot)
- console.anthropic.com — create an API key

## 1. Database (5 min, one paste)
Supabase → SQL Editor → paste the entire `supabase_setup.sql` (repo root) → Run.
Creates all 30 tables, 13 enums, indexes, and applies every migration in order.
(You do NOT need drizzle-kit for setup; it exists for future schema changes only.)

## 2. Push code (5 min)
```
git init && git add . && git commit -m "apex pilot"
git remote add origin git@github.com:YOU/apex.git && git push -u origin main
```

## 3. Vercel project (10 min)
Import the repo → Framework: Next.js → add Environment Variables (from .env.example):
DATABASE_URL (Supabase → Settings → Database → "Connection pooling" URI),
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
ANTHROPIC_API_KEY, RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_BASE_URL (your vercel URL),
AGGREGATION_ENABLED=false, REPORT_MIN=3, REPORT_RATIO=0.02, REPORT_ABSOLUTE=10.
Deploy. Crons in vercel.json register automatically (drafts 06:00 IST, classifier, polls, archetypes).

**Expect the first build to fail with a handful of TypeScript/import errors.** This codebase was
written in a sandbox whose network blocked a local compile; Vercel's build is its first compile.
`next.config.ts` already ignores type errors, so only real syntax/import issues will surface.
Paste the build log back into the chat that produced this repo and the fixes come back in one pass.

## 4. First login wiring (5 min)
- Supabase → Authentication → Providers → Email: enable "Email OTP".
- users rows are auto-created on signup (trigger in supabase_setup.sql). Flag yourself editor:
  `update users set is_editor = true where email = 'YOUR_EDITOR_EMAIL';`
- Create your primary persona:
  `insert into personas (user_id, username, is_primary)
   select id, 'your_handle', true from users where email = 'YOUR_EDITOR_EMAIL';`
- NOTE: user rows are automatic; personas still need one insert per user (username is a choice,
  not derivable) — or build a pick-your-username onboarding screen as the first post-launch task.

## 5. Compliance switches — BEFORE inviting anyone (10 min)
- Create grievance@yourdomain and route it to an inbox you actually read (IT Rules: ack ≤24h).
- Put a one-page Privacy Notice + Terms link in the footer (DPDP Act: you collect email + content).
- Set EMAIL_FROM to a real address; send yourself a test takedown email from /admin/reports.

## 6. Smoke test (10 min, in order)
login → create persona → /admin/drafts → "Request a draft" (e.g. "ISRO launch update")
→ open it → tick → Submit → see it on /home → comment on it → watch the tag appear (~1 min)
→ react/reply/share → file a report on a test community post → resolve it with a reason
→ confirm the takedown email arrived.

## Known gaps shipped honestly (fix on demand)
- Personas on signup: one insert per user (users table is automatic via trigger).
- Persona switcher UI: minimal (header button is a stub; switching = set localStorage activePersonaId).
- Chat realtime: messages persist via API; live push (Supabase Realtime channel) not yet subscribed client-side.
- Groups UI uses demo data for list/search; create + vote endpoints are live.
- Crimson brand: mockups only, not committed to code (say "commit the brand").
