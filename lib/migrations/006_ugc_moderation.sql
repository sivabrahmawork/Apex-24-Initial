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
