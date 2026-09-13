-- NEXORA V5.08.49 — data governance registry.
-- Policy metadata only: RLS/authentication remain authoritative for access control.
create table if not exists public.lia_data_governance_policies (
  id uuid primary key default gen_random_uuid(),
  data_class text not null check (data_class in ('financial','personal','sensitive','memory','mail_metadata','knowledge','context')),
  disposition text not null check (disposition in ('model_allowed','server_only','admin_only','retained_metadata')),
  purpose text not null,
  retention_policy text not null,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(data_class, version)
);

alter table public.lia_data_governance_policies enable row level security;
revoke all on public.lia_data_governance_policies from anon, authenticated;

drop policy if exists "admins read lia data governance policies" on public.lia_data_governance_policies;
create policy "admins read lia data governance policies"
  on public.lia_data_governance_policies for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.email = any(string_to_array(coalesce(current_setting('app.admin_emails', true), ''), ','))));

insert into public.lia_data_governance_policies(data_class,disposition,purpose,retention_policy)
values
 ('financial','model_allowed','Analyse financière et pilotage','governed_by_financial_records_and_user_workspace_policy'),
 ('personal','model_allowed','Personnalisation strictement nécessaire','user_controls_and_applicable_privacy_policy'),
 ('sensitive','server_only','Protection des secrets et identifiants','minimum_necessary_server_retention'),
 ('memory','model_allowed','Contexte mémorisé explicitement gouverné','memory_expiration_and_user_controls'),
 ('mail_metadata','model_allowed','Signaux financiers de messagerie','connection_lifecycle_and_provider_policy'),
 ('knowledge','model_allowed','Contexte et preuves externes','source_status_and_versioning'),
 ('context','model_allowed','Contexte conversationnel et applicatif','session_and_application_policy')
on conflict (data_class,version) do update set disposition=excluded.disposition,purpose=excluded.purpose,retention_policy=excluded.retention_policy,active=true;
