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
