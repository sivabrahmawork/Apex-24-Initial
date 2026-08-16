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
