-- NEXORA v5.08.17: enterprise financial obligations. No new page; obligations live in the Enterprise cockpit.
create table if not exists public.business_financial_obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.financial_workspaces(id) on delete cascade,
  obligation_type text not null check (obligation_type in ('vat','tax','social','supplier','payroll','loan','other')),
  label text not null,
  due_date date not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'planned' check (status in ('planned','paid','cancelled')),
  notes text,
  source text not null default 'manual' check (source in ('manual','imported','system')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_financial_obligations_workspace_due_idx on public.business_financial_obligations(workspace_id,due_date,status);
alter table public.business_financial_obligations enable row level security;
drop policy if exists business_financial_obligations_select_member on public.business_financial_obligations;
create policy business_financial_obligations_select_member on public.business_financial_obligations for select to authenticated using (exists (select 1 from public.financial_workspace_members m where m.workspace_id = business_financial_obligations.workspace_id and m.user_id = auth.uid() and m.status = 'active'));
drop policy if exists business_financial_obligations_insert_member on public.business_financial_obligations;
create policy business_financial_obligations_insert_member on public.business_financial_obligations for insert to authenticated with check (exists (select 1 from public.financial_workspace_members m where m.workspace_id = business_financial_obligations.workspace_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin')));
drop policy if exists business_financial_obligations_update_member on public.business_financial_obligations;
create policy business_financial_obligations_update_member on public.business_financial_obligations for update to authenticated using (exists (select 1 from public.financial_workspace_members m where m.workspace_id = business_financial_obligations.workspace_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin'))) with check (exists (select 1 from public.financial_workspace_members m where m.workspace_id = business_financial_obligations.workspace_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin')));
