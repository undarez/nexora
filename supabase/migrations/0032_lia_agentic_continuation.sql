-- v4.62: persistent agentic continuation state.
-- Control plane only: it never grants financial execution authority.
create table if not exists public.lia_agent_continuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loop_run_id uuid not null references public.agent_loop_runs(id) on delete cascade,
  status text not null default 'active' check (status in ('active','waiting','completed','blocked','cancelled')),
  goal text not null,
  task text not null default 'financial_analysis',
  state jsonb not null default '{}'::jsonb,
  next_check_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 100),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lia_agent_continuations_loop_uidx on public.lia_agent_continuations(loop_run_id);
create index if not exists lia_agent_continuations_due_idx on public.lia_agent_continuations(status,next_check_at);
alter table public.lia_agent_continuations enable row level security;
create policy "users read own agent continuations" on public.lia_agent_continuations for select to authenticated using (user_id=auth.uid());
revoke insert,update,delete on public.lia_agent_continuations from anon,authenticated;
revoke all on public.lia_agent_continuations from public;

create or replace function public.lia_upsert_agent_continuation(p_user_id uuid,p_loop_run_id uuid,p_goal text,p_task text,p_state jsonb,p_next_check_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_goal is null or length(trim(p_goal)) < 2 then raise exception 'invalid_goal'; end if;
  insert into public.lia_agent_continuations(user_id,loop_run_id,goal,task,state,next_check_at,status,updated_at)
  values(p_user_id,p_loop_run_id,left(trim(p_goal),2000),left(coalesce(p_task,'financial_analysis'),80),coalesce(p_state,'{}'::jsonb),p_next_check_at,'active',now())
  on conflict(loop_run_id) do update set goal=excluded.goal,task=excluded.task,state=excluded.state,next_check_at=excluded.next_check_at,status='active',updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.lia_upsert_agent_continuation(uuid,uuid,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.lia_upsert_agent_continuation(uuid,uuid,text,text,jsonb,timestamptz) to service_role;

create or replace function public.lia_claim_agent_continuations(p_limit integer default 10)
returns table(id uuid,user_id uuid,loop_run_id uuid,goal text,task text,state jsonb,attempts integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return query
  with claimed as (
    select c.id from public.lia_agent_continuations c where c.status='active' and (c.next_check_at is null or c.next_check_at <= now()) and c.attempts < 100 order by c.next_check_at nulls first,c.updated_at asc limit greatest(1,least(coalesce(p_limit,10),50)) for update skip locked
  )
  update public.lia_agent_continuations c set status='waiting',attempts=c.attempts+1,updated_at=now() from claimed where c.id=claimed.id returning c.id,c.user_id,c.loop_run_id,c.goal,c.task,c.state,c.attempts;
end; $$;
revoke all on function public.lia_claim_agent_continuations(integer) from public,anon,authenticated;
grant execute on function public.lia_claim_agent_continuations(integer) to service_role;

create or replace function public.lia_finish_agent_continuation(p_id uuid,p_status text,p_state jsonb default '{}'::jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.lia_agent_continuations set status=case when p_status in ('completed','blocked','cancelled') then p_status else 'waiting' end,state=coalesce(p_state,'{}'::jsonb),last_error=left(p_error,1000),updated_at=now() where id=p_id;
  return found;
end; $$;
revoke all on function public.lia_finish_agent_continuation(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.lia_finish_agent_continuation(uuid,text,jsonb,text) to service_role;
