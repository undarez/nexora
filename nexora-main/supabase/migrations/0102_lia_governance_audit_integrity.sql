-- V5.08.45 — tamper-evident governance/audit ledger.
create extension if not exists pgcrypto;

create table if not exists public.lia_governance_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  actor text not null check (actor in ('user','lia','system')),
  correlation_id text,
  source_refs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_governance_audit_user_time on public.lia_governance_audit(user_id,created_at desc);
create index if not exists idx_lia_governance_audit_correlation on public.lia_governance_audit(user_id,correlation_id);
alter table public.lia_governance_audit enable row level security;
create policy "users read own governance audit" on public.lia_governance_audit for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.lia_governance_audit from public, anon, authenticated;

create or replace function public.append_lia_governance_audit(
  p_user_id uuid, p_event_type text, p_actor text, p_correlation_id text,
  p_source_refs jsonb default '{}'::jsonb, p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prev text; new_id uuid:=gen_random_uuid(); created timestamptz:=now(); payload text; h text;
begin
  if p_user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if p_event_type is null or length(trim(p_event_type))=0 or length(p_event_type)>120 then raise exception 'invalid_event_type'; end if;
  if p_actor not in ('user','lia','system') then raise exception 'invalid_actor'; end if;
  select event_hash into prev from public.lia_governance_audit where user_id=p_user_id order by created_at desc,id desc limit 1 for update;
  payload := coalesce(prev,'') || '|' || new_id::text || '|' || p_user_id::text || '|' || p_event_type || '|' || p_actor || '|' || coalesce(p_correlation_id,'') || '|' || coalesce(p_source_refs,'{}'::jsonb)::text || '|' || coalesce(p_metadata,'{}'::jsonb)::text || '|' || created::text;
  h := encode(digest(payload,'sha256'),'hex');
  insert into public.lia_governance_audit(id,user_id,event_type,actor,correlation_id,source_refs,metadata,previous_hash,event_hash,created_at)
  values(new_id,p_user_id,p_event_type,p_actor,p_correlation_id,coalesce(p_source_refs,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb),prev,h,created);
  return jsonb_build_object('id',new_id,'event_hash',h,'previous_hash',prev,'created_at',created);
end; $$;
revoke all on function public.append_lia_governance_audit(uuid,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.append_lia_governance_audit(uuid,text,text,text,jsonb,jsonb) to authenticated;

create or replace function public.verify_lia_governance_audit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; prev text:=null; expected text; payload text; checked integer:=0; ok boolean:=true;
begin
  if p_user_id <> auth.uid() then raise exception 'forbidden'; end if;
  for r in select * from public.lia_governance_audit where user_id=p_user_id order by created_at asc,id asc loop
    payload := coalesce(prev,'') || '|' || r.id::text || '|' || r.user_id::text || '|' || r.event_type || '|' || r.actor || '|' || coalesce(r.correlation_id,'') || '|' || coalesce(r.source_refs,'{}'::jsonb)::text || '|' || coalesce(r.metadata,'{}'::jsonb)::text || '|' || r.created_at::text;
    expected := encode(digest(payload,'sha256'),'hex');
    if r.previous_hash is distinct from prev or r.event_hash is distinct from expected then ok:=false; exit; end if;
    prev:=r.event_hash; checked:=checked+1;
  end loop;
  return jsonb_build_object('valid',ok,'checked',checked,'last_hash',prev);
end; $$;
revoke all on function public.verify_lia_governance_audit(uuid) from public,anon;
grant execute on function public.verify_lia_governance_audit(uuid) to authenticated;
