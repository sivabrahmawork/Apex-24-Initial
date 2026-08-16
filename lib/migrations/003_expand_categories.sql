-- lib/migrations/003_expand_categories.sql
-- Taxonomy modeled on mainstream Indian news sections, minus party politics.
-- 'world' enum value is retained and DISPLAYED as "Global"; crime remains request-only (no cron volume).
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'india';        -- non-political: policy outcomes, courts, infra, economy-on-the-ground
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'business';     -- companies, markets, economy data
ALTER TYPE draft_category ADD VALUE IF NOT EXISTS 'environment';  -- climate, pollution, wildlife, urban ecology
