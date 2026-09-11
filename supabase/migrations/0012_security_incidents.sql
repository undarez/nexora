create table if not exists public.security_incidents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 route text,
 severity text not null check (severity in ('high','critical')),
 reason text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists security_incidents_created_idx on public.security_incidents(created_at desc);
alter table public.security_incidents enable row level security;
revoke all on public.security_incidents from anon, authenticated;
