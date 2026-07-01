-- Run this in Supabase Dashboard → SQL Editor
-- Fixes RLS policies so the app can actually write fee payments

-- 1. Create table if it was never created
CREATE TABLE IF NOT EXISTS fee_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  for_month text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies and create a simple permissive one
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fee_payments;
DROP POLICY IF EXISTS "Authenticated full access" ON fee_payments;
DROP POLICY IF EXISTS "Authenticated users can manage fee_payments" ON fee_payments;

CREATE POLICY "Allow authenticated users full access to fee_payments"
  ON fee_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Also fix fee_plans if needed
CREATE TABLE IF NOT EXISTS fee_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  due_day integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id)
);

ALTER TABLE fee_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to fee_plans" ON fee_plans;
CREATE POLICY "Allow authenticated users full access to fee_plans"
  ON fee_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
