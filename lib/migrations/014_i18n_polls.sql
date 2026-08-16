-- 014_i18n_polls.sql — language preference, polls, comment translation cache.
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'; -- 'en' | 'hi'
ALTER TYPE user_post_type ADD VALUE IF NOT EXISTS 'poll';
ALTER TABLE user_posts ADD COLUMN IF NOT EXISTS poll_options jsonb;          -- ["opt1","opt2",...] (2-4)
CREATE TABLE IF NOT EXISTS poll_votes (
  post_id uuid NOT NULL REFERENCES user_posts(id),
  persona_id uuid NOT NULL REFERENCES personas(id),
  option_index integer NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, persona_id)
);
CREATE TABLE IF NOT EXISTS comment_translations (
  comment_id uuid NOT NULL REFERENCES comments(id),
  lang text NOT NULL,                    -- target language
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, lang)
);
