create table if not exists public.players (
  id text primary key,
  name text not null unique,
  password text not null,
  balance integer not null default 0,
  uc_balance integer not null default 0,
  time_cards integer not null default 0,
  currency_mode text not null default 'metro',
  inventory jsonb not null default '[]'::jsonb,
  mission_progress jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{"profit":0,"cases_opened":0,"upgrades_won":0}'::jsonb,
  avatar text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.case_sections (
  id uuid primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key,
  section_id uuid not null references public.case_sections(id) on delete cascade,
  name text not null,
  image text not null,
  price integer not null default 0,
  contents jsonb not null default '[]'::jsonb,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key,
  code text not null unique,
  promo_type text not null check (promo_type in ('topup', 'regular')),
  reward_amount integer not null default 0 check (reward_amount >= 0),
  max_uses integer not null default 1 check (max_uses >= 1),
  uses_count integer not null default 0 check (uses_count >= 0),
  is_used boolean not null default false,
  used_by text references public.players(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_activation_logs (
  id uuid primary key,
  promo_code text not null,
  player_name text not null default '',
  player_id text references public.players(id) on delete set null,
  promo_type text not null check (promo_type in ('topup', 'regular')),
  reward_amount integer not null default 0,
  activated_at timestamptz not null default now()
);

create table if not exists public.workbench_settings (
  id boolean primary key default true check (id),
  contents jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.get_server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

alter table public.players enable row level security;
alter table public.case_sections enable row level security;
alter table public.cases enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_activation_logs enable row level security;
alter table public.workbench_settings enable row level security;

drop policy if exists "public can read players" on public.players;
drop policy if exists "public can insert players" on public.players;
drop policy if exists "public can update players" on public.players;
drop policy if exists "public can delete players" on public.players;
drop policy if exists "public can read case sections" on public.case_sections;
drop policy if exists "public can insert case sections" on public.case_sections;
drop policy if exists "public can delete case sections" on public.case_sections;
drop policy if exists "public can read cases" on public.cases;
drop policy if exists "public can insert cases" on public.cases;
drop policy if exists "public can delete cases" on public.cases;
drop policy if exists "public can update cases" on public.cases;
drop policy if exists "public can read promo codes" on public.promo_codes;
drop policy if exists "public can insert promo codes" on public.promo_codes;
drop policy if exists "public can update promo codes" on public.promo_codes;
drop policy if exists "public can delete promo codes" on public.promo_codes;
drop policy if exists "public can read promo activation logs" on public.promo_activation_logs;
drop policy if exists "public can insert promo activation logs" on public.promo_activation_logs;
drop policy if exists "public can read workbench settings" on public.workbench_settings;
drop policy if exists "public can insert workbench settings" on public.workbench_settings;
drop policy if exists "public can update workbench settings" on public.workbench_settings;

create policy "public can read players" on public.players for select using (true);
create policy "public can insert players" on public.players for insert with check (true);
create policy "public can update players" on public.players for update using (true) with check (true);
create policy "public can delete players" on public.players for delete using (true);
create policy "public can read case sections" on public.case_sections for select using (true);
create policy "public can insert case sections" on public.case_sections for insert with check (true);
create policy "public can delete case sections" on public.case_sections for delete using (true);
create policy "public can read cases" on public.cases for select using (true);
create policy "public can insert cases" on public.cases for insert with check (true);
create policy "public can delete cases" on public.cases for delete using (true);
create policy "public can update cases" on public.cases for update using (true) with check (true);
create policy "public can read promo codes" on public.promo_codes for select using (true);
create policy "public can insert promo codes" on public.promo_codes for insert with check (true);
create policy "public can update promo codes" on public.promo_codes for update using (true) with check (true);
create policy "public can delete promo codes" on public.promo_codes for delete using (true);
create policy "public can read promo activation logs" on public.promo_activation_logs for select using (true);
create policy "public can insert promo activation logs" on public.promo_activation_logs for insert with check (true);
create policy "public can read workbench settings" on public.workbench_settings for select using (true);
create policy "public can insert workbench settings" on public.workbench_settings for insert with check (true);
create policy "public can update workbench settings" on public.workbench_settings for update using (true) with check (true);

alter table public.cases add column if not exists contents jsonb not null default '[]'::jsonb;
alter table public.promo_codes add column if not exists max_uses integer not null default 1;
alter table public.promo_codes add column if not exists uses_count integer not null default 0;
alter table public.players add column if not exists mission_progress jsonb not null default '{}'::jsonb;
alter table public.players add column if not exists stats jsonb not null default '{"profit":0,"cases_opened":0,"upgrades_won":0}'::jsonb;
alter table public.players add column if not exists avatar text not null default '';