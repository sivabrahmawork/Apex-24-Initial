# Apex — structured news discussion platform (pilot build)

Verified 5W news cards (Claude-drafted, human-published) + community posts + typed discussion
with post-hoc AI classification + groups with 75%-consensus publishing + full moderation/compliance rail.

## Stack
Next.js 15 (App Router, TS) · Supabase (Postgres + email-OTP auth) · Drizzle ORM · Claude API · Resend · Vercel.

## Setup (~20 min)
1. `npm install`
2. Create a Supabase project → copy keys into `.env` (see `.env.example`).
3. Schema: `npx drizzle-kit generate && npx drizzle-kit migrate` (uses `lib/schema.ts` + `lib/drafts-schema.ts`),
   then run `lib/migrations/002…008.sql` in order via the Supabase SQL editor.
   Also create the cost-log table:
   `create table ai_calls (id bigint generated always as identity primary key, purpose text, model text, in_tokens int, out_tokens int, ms int, created_at timestamptz default now());`
4. Mark yourself editor: `update users set is_editor = true where email = 'you@...';` (after first login).
5. `npm run dev` → http://localhost:3000/login
6. Deploy: push to Vercel, set the same env vars; `vercel.json` schedules the three crons
   (daily draft batch 06:00 IST, classification worker, poll closer).

## Screens
- `/news` — feed: Apex 5W cards (tag: "Apex · verified 5W") + Community posts, dynamic category chips
- `/news/[id]`, `/posts/[id]` — detail + typed discussion (auto-tagged: question/assumption/analysis/pro/con/solution)
- `/news/post` — community article composer; tweet box on `/news`
- `/groups` — discuss → poll (72h; 75%, unanimity under 4) → publish to News
- `/chat`, `/profile/[username]`, `/login`
- `/admin` — manual 5W card editor (verbatim-overlap guard, 100-word cap)
- `/admin/drafts` — daily 20-card batch + request-a-draft; open-to-unlock review gate; filters
- `/admin/reports` — report cases w/ Claude assessment; reasoned takedowns (emailed to author);
  legal-order intake (confidential toggle per S.69A Rule 16); delete-any-post with logged reason

## Non-negotiable guards (do not remove without re-reading the legal history)
- No scraping anywhere; news RSS pipeline exists but ships behind `AGGREGATION_ENABLED=false`
- Publish requires human open-then-tick; server re-verifies
- Indian party-politics excluded from ALL Apex-generated drafts (users may post it; safe harbor)
- Crime drafts: request-only; never name unconvicted suspects; no victim/minor identification
- Every takedown: reason mandatory, logged, emailed; content hidden, never erased
- Grievance inbox (grievance@…) + named grievance officer required BEFORE first takedown email

## Deferred (see /deferred/home-media)
Instagram-style Home (photo/carousel posts + vision screening) — built, then removed by product decision.
Re-entry gate: revisit only with post-launch evidence of demand for identity expression beyond discussion
(meaningful share of weekly-active users posting articles/tweets and requesting media). Restore = move files back,
run 009 migration, re-add nav link.

## Open business items (not code)
PTI/IANS wire-license quotes; pilot cohort (city + first 200 users); DPDP privacy notice; ToS.
