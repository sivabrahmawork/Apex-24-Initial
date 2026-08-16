-- lib/migrations/002_categories.sql
-- 1. New category for on-demand crime drafts (guarded prompt rules apply in pipeline.ts)
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'crime';

-- 2. Published cards carry their category so the News screen can filter.
--    Nullable: pre-existing rows and group solutions have no category ("All" still shows them).
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS content_category_idx ON content_items (category, status, published_at);

-- 3. Provenance for on-demand drafts (daily cron rows leave this null)
ALTER TABLE daily_drafts ADD COLUMN IF NOT EXISTS requested_topic text;
