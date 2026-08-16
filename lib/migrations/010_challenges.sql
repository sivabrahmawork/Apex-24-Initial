-- lib/migrations/010_challenges.sql — Apex Challenges: long-form neutral research briefs.
-- Guard rails: facts-only/own-words enforced by the same verbatim-overlap check as 5W cards;
-- rendered with "Apex Challenges" tag and an "s" sources button; intended to seed group discussion.
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'challenge';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS body text;  -- full brief text (challenges only)
