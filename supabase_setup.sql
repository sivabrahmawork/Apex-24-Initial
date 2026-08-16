-- 000_base.sql — full base schema (hand-authored equivalent of lib/schema.ts + lib/drafts-schema.ts).
-- Part of supabase_setup.sql: paste the bundled file once into the Supabase SQL editor.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE content_type AS ENUM ('news','essay');
CREATE TYPE content_origin AS ENUM ('editor','rss','link_submission');
CREATE TYPE content_status AS ENUM ('draft','published','takedown');
CREATE TYPE user_post_type AS ENUM ('discussion','article');
CREATE TYPE comment_target AS ENUM ('content_item','user_post','group');
CREATE TYPE comment_label AS ENUM ('question','assumption','analysis','pro','con','solution');
CREATE TYPE queue_status AS ENUM ('pending','processing','done','failed');
CREATE TYPE summary_kind AS ENUM ('summary','swot','pros_cons','solutions','assumptions');
CREATE TYPE solution_status AS ENUM ('discussing','polling','published','failed');
CREATE TYPE feed_kind AS ENUM ('substack','medium','news_rss');
CREATE TYPE takedown_status AS ENUM ('open','removed','rejected');
CREATE TYPE draft_status AS ENUM ('pending','published','discarded');
CREATE TYPE draft_category AS ENUM ('world','tech','science','sports','health','entertainment');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  is_editor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  username varchar(30) NOT NULL UNIQUE,
  is_primary boolean NOT NULL,
  avatar_url text,
  archetype text,
  archetype_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personas_user_idx ON personas (user_id);

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type content_type NOT NULL,
  origin content_origin NOT NULL,
  status content_status NOT NULL DEFAULT 'draft',
  headline_rewritten text NOT NULL,
  five_w jsonb,
  excerpt text,
  author_name text,
  created_by_user uuid REFERENCES users(id),
  submitted_by_persona uuid REFERENCES personas(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_status_type_idx ON content_items (status, type, published_at);

CREATE TABLE content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id),
  publisher text NOT NULL,
  author text,
  url text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_item_idx ON content_sources (content_item_id);
CREATE INDEX sources_publisher_idx ON content_sources (publisher);

CREATE TABLE feed_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind feed_kind NOT NULL,
  feed_url text NOT NULL UNIQUE,
  publisher text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz
);
CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_source_id uuid NOT NULL REFERENCES feed_sources(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  items_found integer NOT NULL DEFAULT 0,
  items_created integer NOT NULL DEFAULT 0,
  error text
);
CREATE TABLE takedown_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id),
  requester_email text NOT NULL,
  reason text,
  status takedown_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE TABLE user_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id),
  type user_post_type NOT NULL,
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_posts_persona_idx ON user_posts (persona_id);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id),
  target_type comment_target NOT NULL,
  target_id uuid NOT NULL,
  parent_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_target_idx ON comments (target_type, target_id, created_at);

CREATE TABLE comment_classifications (
  comment_id uuid PRIMARY KEY REFERENCES comments(id),
  label comment_label NOT NULL,
  confidence real NOT NULL,
  model_version text NOT NULL,
  user_corrected boolean NOT NULL DEFAULT false,
  corrected_label comment_label,
  classified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE classification_queue (
  comment_id uuid PRIMARY KEY REFERENCES comments(id),
  status queue_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE thread_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type comment_target NOT NULL,
  target_id uuid NOT NULL,
  kind summary_kind NOT NULL,
  content jsonb NOT NULL,
  comments_at_generation integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT summary_unique UNIQUE (target_type, target_id, kind)
);
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(60) NOT NULL,
  description varchar(100) NOT NULL,
  created_by_persona uuid NOT NULL REFERENCES personas(id),
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id),
  persona_id uuid NOT NULL REFERENCES personas(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, persona_id)
);
CREATE TABLE group_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  proposed_by_persona uuid NOT NULL REFERENCES personas(id),
  body text NOT NULL,
  status solution_status NOT NULL DEFAULT 'discussing',
  poll_opens_at timestamptz,
  poll_closes_at timestamptz,
  eligible_count integer,
  threshold_pct integer,
  published_content_item_id uuid REFERENCES content_items(id)
);
CREATE TABLE solution_votes (
  solution_id uuid NOT NULL REFERENCES group_solutions(id),
  persona_id uuid NOT NULL REFERENCES personas(id),
  approve boolean NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (solution_id, persona_id)
);
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  persona_id uuid NOT NULL REFERENCES personas(id),
  PRIMARY KEY (conversation_id, persona_id)
);
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  sender_persona_id uuid NOT NULL REFERENCES personas(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_convo_idx ON messages (conversation_id, created_at);

CREATE TABLE follows (
  follower_persona_id uuid NOT NULL REFERENCES personas(id),
  followed_persona_id uuid NOT NULL REFERENCES personas(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_persona_id, followed_persona_id)
);
CREATE TABLE daily_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_date date NOT NULL,
  category draft_category NOT NULL,
  headline_rewritten text NOT NULL,
  five_w jsonb NOT NULL,
  sources jsonb NOT NULL,
  status draft_status NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  published_content_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drafts_date_idx ON daily_drafts (draft_date, status);

-- 001: mandatory Claude cost log
CREATE TABLE ai_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purpose text, model text, in_tokens int, out_tokens int, ms int,
  created_at timestamptz DEFAULT now()
);
-- lib/migrations/002_categories.sql
-- 1. New category for on-demand crime drafts (guarded prompt rules apply in pipeline.ts)
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'crime';

-- 2. Published cards carry their category so the News screen can filter.
--    Nullable: pre-existing rows and group solutions have no category ("All" still shows them).
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS content_category_idx ON content_items (category, status, published_at);

-- 3. Provenance for on-demand drafts (daily cron rows leave this null)
ALTER TABLE daily_drafts ADD COLUMN IF NOT EXISTS requested_topic text;
-- lib/migrations/003_expand_categories.sql
-- Taxonomy modeled on mainstream Indian news sections, minus party politics.
-- 'world' enum value is retained and DISPLAYED as "Global"; crime remains request-only (no cron volume).
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'india';        -- non-political: policy outcomes, courts, infra, economy-on-the-ground
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'business';     -- companies, markets, economy data
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'environment';  -- climate, pollution, wildlife, urban ecology
-- lib/migrations/004_full_taxonomy.sql
-- Completes the mainstream-news-section set. Party-politics exclusion and crime=request-only are
-- generation-side guards in pipeline.ts and are NOT relaxed by this migration.
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'lifestyle';  -- food, travel, culture, trends
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'education';  -- exams, admissions, institutions, edtech (policy as facts; no party politics)
-- lib/migrations/006_ugc_moderation.sql
-- Tweets + view-counting + Claude-reviewed report pipeline.
ALTER TYPE user_post_type ADD VALUE IF NOT EXISTS 'tweet';           -- short posts, ≤280 chars (app-enforced)
ALTER TABLE user_posts ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
ALTER TABLE user_posts ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,           -- 'user_post'
  target_id uuid NOT NULL,
  reporter_persona uuid,               -- nullable: anonymous report allowed
  reason text,                         -- complaint text from the reporter
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_target_idx ON moderation_reports (target_type, target_id);

-- One case per post once the threshold trips; carries Claude's assessment to the editor console.
CREATE TABLE IF NOT EXISTS moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL UNIQUE,      -- user_posts.id
  report_count integer NOT NULL,
  view_count integer NOT NULL,
  claude_assessment jsonb,             -- {summary, categories[], severity, recommendation, reasoning}
  status text NOT NULL DEFAULT 'awaiting_editor',  -- awaiting_editor | taken_down | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
-- IT Rules clocks are ops obligations: acknowledge grievances ≤24h, resolve ≤15 days,
-- unlawful-content takedown ≤36h of actual knowledge. The console surfaces created_at for this.
-- lib/migrations/007_legal_admin.sql — legal-order intake + editor action log + author notices.
CREATE TABLE IF NOT EXISTS legal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  agency text NOT NULL,          -- issuing authority (court / authorized agency)
  order_ref text NOT NULL,       -- order or notification reference number
  legal_basis text NOT NULL,     -- e.g. "S.69A IT Act", "IT Rules 3(1)(d)", court case no.
  actioned_by uuid NOT NULL,     -- editor user id
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS editor_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  action text NOT NULL,          -- 'deleted'
  reason text NOT NULL,          -- mandatory, shown on internal audit
  editor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS author_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  kind text NOT NULL,            -- 'legal_takedown' | 'editor_removal'
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- lib/migrations/008_takedown_notices.sql — unified reason + email trail on every takedown path.
ALTER TABLE author_notices ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE author_notices ADD COLUMN IF NOT EXISTS emailed boolean NOT NULL DEFAULT false;
ALTER TABLE legal_orders   ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE legal_orders   ADD COLUMN IF NOT EXISTS confidential boolean NOT NULL DEFAULT false;
ALTER TABLE moderation_cases ADD COLUMN IF NOT EXISTS takedown_reason text;
-- lib/migrations/010_challenges_feedback.sql
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'challenge';   -- Apex Challenges: researched problem briefs
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS body text;  -- full-length brief text (news cards leave null)

CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid REFERENCES personas(id),   -- nullable: anonymous feedback allowed
  topic text,                                -- optional: what it concerns (feature/content/bug/other)
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feedback_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content jsonb NOT NULL,                    -- {themes:[{theme,count,example}], top_requests[], sentiment}
  feedback_count integer NOT NULL,           -- regenerate when count grows
  created_at timestamptz NOT NULL DEFAULT now()
);
-- lib/migrations/011_reactions.sql — like/dislike on ANY target (news cards, community posts, comments).
CREATE TABLE IF NOT EXISTS reactions (
  target_type text NOT NULL,          -- 'content_item' | 'user_post' | 'comment'
  target_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES personas(id),
  liked boolean NOT NULL,             -- true = like, false = dislike; row deleted on un-react
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, persona_id)
);
CREATE INDEX IF NOT EXISTS reactions_target_idx ON reactions (target_type, target_id);
-- lib/migrations/012_archetypes.sql — persona-level archetype (Questioner/Solver/Analyst).
ALTER TABLE personas ADD COLUMN IF NOT EXISTS archetype text;             -- null until earned
ALTER TABLE personas ADD COLUMN IF NOT EXISTS archetype_computed_at timestamptz;

-- 013: signup auto-provisioning — auth.users -> public.users (kills the manual insert per user).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
