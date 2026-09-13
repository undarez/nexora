-- NEXORA Enterprise financial scope: keep personal and business ledgers distinct.
-- Existing rows remain personal-compatible (workspace_id NULL) until explicitly attached.
alter table public.bank_connections add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.bank_accounts add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.bank_transactions add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.accounts add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.transactions add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.budget_scenarios add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;
alter table public.fixed_expenses add column if not exists workspace_id uuid references public.financial_workspaces(id) on delete set null;

create index if not exists bank_connections_workspace_idx on public.bank_connections(workspace_id, status);
create index if not exists bank_accounts_workspace_idx on public.bank_accounts(workspace_id, status);
create index if not exists bank_transactions_workspace_date_idx on public.bank_transactions(workspace_id, booked_at desc);
create index if not exists accounts_workspace_idx on public.accounts(workspace_id, created_at desc);
create index if not exists transactions_workspace_date_idx on public.transactions(workspace_id, occurred_at desc);
create unique index if not exists budget_scenarios_workspace_period_uidx on public.budget_scenarios(workspace_id, period_start) where workspace_id is not null;
create index if not exists fixed_expenses_workspace_idx on public.fixed_expenses(workspace_id, effective_from desc);

-- Members of a business workspace can read its scoped financial rows.
-- Owner/user RLS remains valid for personal rows.
drop policy if exists bank_connections_workspace_select on public.bank_connections;
create policy bank_connections_workspace_select on public.bank_connections
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = bank_connections.workspace_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists bank_accounts_workspace_select on public.bank_accounts;
create policy bank_accounts_workspace_select on public.bank_accounts
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = bank_accounts.workspace_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists bank_transactions_workspace_select on public.bank_transactions;
create policy bank_transactions_workspace_select on public.bank_transactions
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = bank_transactions.workspace_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists accounts_workspace_select on public.accounts;
create policy accounts_workspace_select on public.accounts
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = accounts.workspace_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists transactions_workspace_select on public.transactions;
create policy transactions_workspace_select on public.transactions
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = transactions.workspace_id and m.user_id = auth.uid() and m.status = 'active'));


drop policy if exists budget_scenarios_workspace_select on public.budget_scenarios;
create policy budget_scenarios_workspace_select on public.budget_scenarios
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = budget_scenarios.workspace_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists fixed_expenses_workspace_select on public.fixed_expenses;
create policy fixed_expenses_workspace_select on public.fixed_expenses
  for select to authenticated using (workspace_id is not null and exists (select 1 from public.financial_workspace_members m where m.workspace_id = fixed_expenses.workspace_id and m.user_id = auth.uid() and m.status = 'active'));
