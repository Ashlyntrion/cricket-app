-- Run in Supabase SQL Editor
-- Adds the unique constraint needed for fee payment upserts to work correctly
ALTER TABLE fee_payments
  ADD CONSTRAINT IF NOT EXISTS fee_payments_student_month_unique
  UNIQUE (student_id, for_month);
