-- Run this in your Supabase SQL Editor
-- Adds structured training days to batches (replaces free-text schedule field)

ALTER TABLE batches ADD COLUMN IF NOT EXISTS training_days text[] DEFAULT '{}';
