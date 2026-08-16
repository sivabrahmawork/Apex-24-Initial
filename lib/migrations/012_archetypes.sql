-- lib/migrations/012_archetypes.sql — persona-level archetype (Questioner/Solver/Analyst).
ALTER TABLE personas ADD COLUMN IF NOT EXISTS archetype text;             -- null until earned
ALTER TABLE personas ADD COLUMN IF NOT EXISTS archetype_computed_at timestamptz;
