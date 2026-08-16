-- lib/migrations/004_full_taxonomy.sql
-- Completes the mainstream-news-section set. Party-politics exclusion and crime=request-only are
-- generation-side guards in pipeline.ts and are NOT relaxed by this migration.
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'lifestyle';  -- food, travel, culture, trends
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'education';  -- exams, admissions, institutions, edtech (policy as facts; no party politics)
