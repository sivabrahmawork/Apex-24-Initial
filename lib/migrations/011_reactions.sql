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
