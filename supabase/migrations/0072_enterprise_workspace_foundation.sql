-- NEXORA Enterprise foundation. Idempotent so it can be replayed against a database
-- that already received the initial enterprise_foundations migration.
create table if not exists public.financial_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('personal','business')),
  name text not null,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_workspace_members (
  workspace_id uuid not null references public.financial_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.business_profiles (
  workspace_id uuid primary key references public.financial_workspaces(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  siret text not null check (siret ~ '^[0-9]{14}$'),
  siren text,
  legal_form text,
  activity_code text,
  activity_label text,
  address_line text,
  postal_code text,
  city text,
  country_code text not null default 'FR',
  vat_number text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','expired')),
  verification_source text,
  verified_at timestamptz,
  sirene_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_workspace_business_siret_uidx on public.business_profiles(siret);
create index if not exists financial_workspace_owner_idx on public.financial_workspaces(owner_user_id, status);
create index if not exists financial_workspace_member_user_idx on public.financial_workspace_members(user_id, status);
create index if not exists financial_workspace_member_workspace_idx on public.financial_workspace_members(workspace_id, status);

alter table public.financial_workspaces enable row level security;
alter table public.financial_workspace_members enable row level security;
alter table public.business_profiles enable row level security;

drop policy if exists financial_workspaces_select_member on public.financial_workspaces;
create policy financial_workspaces_select_member on public.financial_workspaces
  for select using (exists (select 1 from public.financial_workspace_members m where m.workspace_id = id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists financial_workspace_members_select_self on public.financial_workspace_members;
create policy financial_workspace_members_select_self on public.financial_workspace_members
  for select using (user_id = auth.uid());

drop policy if exists business_profiles_select_member on public.business_profiles;
create policy business_profiles_select_member on public.business_profiles
  for select using (exists (select 1 from public.financial_workspace_members m where m.workspace_id = business_profiles.workspace_id and m.user_id = auth.uid() and m.status = 'active'));
