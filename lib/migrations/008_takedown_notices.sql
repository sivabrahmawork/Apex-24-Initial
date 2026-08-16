-- lib/migrations/008_takedown_notices.sql — unified reason + email trail on every takedown path.
ALTER TABLE author_notices ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE author_notices ADD COLUMN IF NOT EXISTS emailed boolean NOT NULL DEFAULT false;
ALTER TABLE legal_orders   ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE legal_orders   ADD COLUMN IF NOT EXISTS confidential boolean NOT NULL DEFAULT false;
ALTER TABLE moderation_cases ADD COLUMN IF NOT EXISTS takedown_reason text;
