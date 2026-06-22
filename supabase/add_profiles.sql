-- Run this in your Supabase SQL Editor

-- 1. Create profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Coach',
  email text,
  role text not null default 'coach',  -- 'admin' or 'coach'
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table profiles enable row level security;

-- 3. All signed-in coaches can view all profiles
create policy "Coaches can view all profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- 4. Users can insert their own profile
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- 5. Users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- 6. Set YOU as admin (run this after the table is created)
insert into profiles (id, full_name, email, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  email,
  'admin'
from auth.users
where email = 'ashlynramesh@gmail.com'
on conflict (id) do update set role = 'admin';
