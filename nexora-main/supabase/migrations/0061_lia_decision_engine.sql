-- LIA Decision Engine: auditable procedure selection and bounded decision records.
create table if not exists public.lia_decision_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id uuid references public.lia_procedures(id) on delete set null, objective text not null,
  context jsonb not null default '{}'::jsonb, decision jsonb not null default '{}'::jsonb,
  risk_class text not null default 'read' check (risk_class in ('read','recommendation','write-sensitive','critical')),
  autonomy_level integer not null default 0 check (autonomy_level between 0 and 8),
  max_autonomy_level integer not null default 0 check (max_autonomy_level between 0 and 8),
  human_gate_required boolean not null default false,
  status text not null default 'planned' check (status in ('planned','blocked','awaiting_human','approved','executing','completed','failed','cancelled')),
  reason text, verification jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists idx_lia_decision_records_user_created on public.lia_decision_records(user_id,created_at desc);
create index if not exists idx_lia_decision_records_status on public.lia_decision_records(status);
alter table public.lia_decision_records enable row level security;
drop policy if exists lia_decision_records_owner on public.lia_decision_records;
create policy lia_decision_records_owner on public.lia_decision_records for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.lia_record_decision(p_user_id uuid,p_procedure_id uuid,p_objective text,p_context jsonb,p_decision jsonb,p_risk_class text,p_autonomy_level integer,p_human_gate_required boolean,p_status text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare rid uuid; max_level integer; begin
 if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
 select coalesce(max_autonomy_level,0) into max_level from lia_autonomy_profiles where user_id=p_user_id; max_level:=coalesce(max_level,0);
 insert into lia_decision_records(user_id,procedure_id,objective,context,decision,risk_class,autonomy_level,max_autonomy_level,human_gate_required,status,reason) values(p_user_id,p_procedure_id,p_objective,coalesce(p_context,'{}'),coalesce(p_decision,'{}'),p_risk_class,p_autonomy_level,max_level,p_human_gate_required,p_status,p_reason) returning id into rid; return rid; end; $$;
revoke all on function public.lia_record_decision(uuid,uuid,text,jsonb,jsonb,text,integer,boolean,text,text) from public;
grant execute on function public.lia_record_decision(uuid,uuid,text,jsonb,jsonb,text,integer,boolean,text,text) to authenticated;
