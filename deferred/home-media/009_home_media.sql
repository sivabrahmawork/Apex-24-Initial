-- lib/migrations/009_home_media.sql — Home screen: user photo/carousel posts (video deferred by decision).
ALTER TYPE user_post_type ADD VALUE IF NOT EXISTS 'media';

CREATE TABLE IF NOT EXISTS post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES user_posts(id),
  url text NOT NULL,                 -- Supabase Storage public URL (bucket: media)
  position integer NOT NULL DEFAULT 0,
  screen_verdict text,               -- 'pass' | 'blocked:<category>' from Claude vision screen
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_media_post_idx ON post_media (post_id, position);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id uuid NOT NULL REFERENCES user_posts(id),
  persona_id uuid NOT NULL REFERENCES personas(id),
  liked boolean NOT NULL,            -- true = like, false = dislike (deck spec)
  PRIMARY KEY (post_id, persona_id)
);
-- Storage: create Supabase bucket "media", public read, authenticated write, 10MB/file limit.
