-- Cricket Coach Academy — Supabase Schema
-- Run this in your Supabase SQL editor

-- Batches (training groups)
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schedule text not null default 'Mon–Fri',
  time text not null default '7:00 AM',
  created_at timestamptz default now()
);

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  batch_id uuid references batches(id) on delete set null,
  join_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Training sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  unique(batch_id, date)
);

-- Attendance records
create table attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  created_at timestamptz default now(),
  unique(session_id, student_id)
);

-- Fee plans (one per student)
create table fee_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade unique,
  amount numeric not null,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly')),
  due_day integer not null default 25 check (due_day between 1 and 31),
  created_at timestamptz default now()
);

-- Fee payments (one per student per month)
create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  amount numeric not null,
  payment_date date,
  for_month text not null,   -- format: 'YYYY-MM'
  notes text,
  created_at timestamptz default now(),
  unique(student_id, for_month)
);

-- Indexes for common queries
create index on attendance(student_id);
create index on attendance(session_id);
create index on sessions(batch_id, date);
create index on fee_payments(student_id, for_month);
create index on students(batch_id, is_active);

-- Sample data (optional — delete before production)
insert into batches (name, schedule, time) values
  ('Morning U-15', 'Mon–Fri', '7:00 AM'),
  ('Evening Advanced', 'Mon–Sat', '5:00 PM'),
  ('Beginners', 'Sat–Sun', '9:00 AM');
