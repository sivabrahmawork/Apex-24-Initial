# Apex — Phase (a) API Contract (Next.js App Router route handlers)

Auth: Supabase email OTP. Every authenticated request resolves `user` + `activePersona`
(client sends `X-Active-Persona`; server verifies persona belongs to user).
All writes are persona-attributed. Personas: max 2 per user, one primary (DB + app enforced).

## Auth & identity
- `POST /api/auth/otp` — send code to email (Supabase).
- `POST /api/personas` — create second persona (rejects if 2 exist). Body: {username, avatarUrl?}
- `GET /api/personas/me` — list my personas.
- `PATCH /api/personas/:id` — edit avatar/username (username change: secondary persona only).

## Content (sourced — News & Essays screen)
- `GET /api/content?type=news|essay&cursor=` — published items: headlineRewritten, fiveW, excerpt,
  authorName, sources[] (publisher, url), badge {prosHigh, consHigh}, commentCount.
- `GET /api/content/:id` — item + full source list ("i" panel) + comment thread head.
- `POST /api/content` — **editor only**: create news item {headlineRewritten, fiveW, sources[]}.
  Server-side guard: rejects if fiveW text has ≥8-word verbatim overlap with any source excerpt on file.
- `POST /api/content/link` — submit old article URL → server fetches OpenGraph metadata ONLY
  (title/author/site) → creates essay item, origin=link_submission, status=draft → editor approves.
- `POST /api/takedown` — public endpoint {url|contentItemId, requesterEmail, reason} → ops queue, 24h SLA.

## Ingestion (RSS only)
- Cron `ingest-feeds` (every 30 min): for each enabled feed_source → fetch RSS → normalize →
  dedupe by canonical URL → create essay items (headline rewritten via Claude, excerpt = feed-provided,
  capped 300 chars) as drafts; auto-publish only for feeds marked trusted. news_rss rows exist but
  `AGGREGATION_ENABLED=false` skips them (design shipped, execution off — per legal ruling).
- `POST /api/admin/feeds` — editor: register Substack/Medium feed URL.

## User posts
- `POST /api/posts` — {type: discussion|article, title?, body}. `GET /api/posts/:id`,
  `GET /api/posts?persona=`, `PATCH/DELETE /api/posts/:id` (owner only).

## Comments & classification
- `POST /api/comments` — {targetType, targetId, parentId?, body} → insert + enqueue classification. No type picker (per decision 2).
- Cron `classify-comments` (every 1 min): drain queue in batches of 20 → Claude Haiku, few-shot,
  labels {question|assumption|analysis|pro|con|solution} + confidence → write classification.
  Confidence < 0.55 → no visible tag (better untagged than wrong).
- `POST /api/comments/:id/correct-tag` — comment author or any user flags; author's correction applies
  immediately (userCorrected=true); others' flags queue for editor review.
- `GET /api/comments?targetType=&targetId=&sort=new|top` — thread with effective labels.
- Badge rule (computed in query): ≥4 effective pro/con replies on a post; >50% share → High.

## AI Summarize (per post, >5 comments, cached)
- `POST /api/summarize` — {targetType, targetId, kind: summary|swot|pros_cons|solutions|assumptions}.
  Guard: commentCount > 5 else 403. Cache hit if stored summary exists and
  commentCount < commentsAtGeneration + 5; else regenerate via Claude and upsert.

## Groups
- `POST /api/groups` {title≤60, desc≤100, memberUsernames[]} · `POST /api/groups/join` {shareToken|groupId}
- `GET /api/groups/mine`, `GET /api/groups/search?q=`
- Group discussion = comments with targetType=group (members only, RLS-enforced).
- `POST /api/groups/:id/solutions` — propose solution text.
- `POST /api/solutions/:id/open-poll` — snapshots eligibleCount = current members;
  thresholdPct = eligibleCount < 4 ? 100 : 75; pollClosesAt = now + 72h.
- `POST /api/solutions/:id/vote` {approve} — members in snapshot only, one vote, changeable until close.
- Cron `close-polls` (hourly): approvals/eligibleCount ≥ threshold → status=published +
  create content_item (type=news? **No** — published solutions render on News screen as their own
  card type via origin=editor? → decision: stored as content_item type=essay, origin=editor,
  authorName=group title, open to all-user comments per deck) ; else status=failed.
- `GET /api/groups/:id/solutions` — history with vote tallies.

## Chat (1:1, text)
- `POST /api/conversations` {personaId} — find-or-create 1:1.
- `GET /api/conversations` — my active persona's inbox. `GET/POST /api/conversations/:id/messages`
  (Supabase Realtime channel per conversation for live delivery).

## Follows & profile
- `POST/DELETE /api/follows` {personaId} · `GET /api/profile/:username` — persona board:
  counts {questions, solutions, analyses, publishedSolutions, followers} from classifications + groups.

## Cross-cutting
- RLS: personas write-scoped to owner; group content member-scoped; content_items editor-scoped.
- Rate limits: 10 comments/min, 3 posts/hr, 30 messages/min per persona.
- Moderation hooks (Phase e): report endpoint + hidden-state on all user content tables.
- Every Claude call logged {model, tokens, latency, purpose} → cost dashboard from day one.
