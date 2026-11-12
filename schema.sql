-- MindMate AI database schema (Supabase / PostgreSQL)
-- Run once in: Supabase Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create extension if not exists pgcrypto;

-- ============ profiles (one row per user) ============
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 40),
  age_group    text check (age_group in ('13–17','18–24','25–34','35–49','50+')),
  role         text check (role in ('Student','Job seeker','Working professional','Life transition')),
  concerns     text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============ mood entries ============
create table if not exists public.mood_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood       text not null check (mood in ('very_happy','happy','neutral','sad','stressed')),
  note       text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists mood_entries_user_created_idx on public.mood_entries (user_id, created_at desc);

-- ============ journal entries (journal + gratitude) ============
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null default 'journal' check (kind in ('gratitude','journal')),
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);

-- keep profiles.updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ============ Row Level Security: users can only see and change their own rows ============
alter table public.profiles        enable row level security;
alter table public.mood_entries    enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "profiles own"  on public.profiles;
drop policy if exists "mood own"      on public.mood_entries;
drop policy if exists "journal own"   on public.journal_entries;

create policy "profiles own" on public.profiles        for all to authenticated using (auth.uid() = id)      with check (auth.uid() = id);
create policy "mood own"     on public.mood_entries    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal own"  on public.journal_entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No access for the anonymous role at all.
revoke all on public.profiles, public.mood_entries, public.journal_entries from anon;
grant select, insert, update, delete on public.profiles, public.mood_entries, public.journal_entries to authenticated;
