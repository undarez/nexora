-- v4.63: multi-objective agent mission queue.
-- Missions are orchestration state only; they never grant financial execution authority.
create table if not exists public.lia_agent_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.lia_agent_missions(id) on delete cascade,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','paused','waiting','completed','blocked','cancelled')),
  priority integer not null default 50 check (priority between 0 and 100),
  goal text not null,
  task text not null default 'financial_analysis',
  state jsonb not null default '{}'::jsonb,
  depends_on uuid[] not null default '{}'::uuid[],
  next_run_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 100),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lia_agent_missions_queue_idx on public.lia_agent_missions(status, priority desc, next_run_at asc);
create index if not exists lia_agent_missions_user_idx on public.lia_agent_missions(user_id, status, priority desc);
alter table public.lia_agent_missions enable row level security;
create policy "users read own agent missions" on public.lia_agent_missions for select to authenticated using (user_id=auth.uid());
revoke insert,update,delete on public.lia_agent_missions from anon,authenticated;
revoke all on public.lia_agent_missions from public;

create or replace function public.lia_enqueue_agent_mission(p_user_id uuid,p_goal text,p_task text default 'financial_analysis',p_priority integer default 50,p_parent_id uuid default null,p_depends_on uuid[] default '{}',p_state jsonb default '{}',p_next_run_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_goal is null or length(trim(p_goal)) < 2 then raise exception 'invalid_goal'; end if;
  insert into public.lia_agent_missions(user_id,parent_id,goal,task,priority,depends_on,state,next_run_at)
  values(p_user_id,p_parent_id,left(trim(p_goal),2000),left(coalesce(p_task,'financial_analysis'),80),greatest(0,least(coalesce(p_priority,50),100)),coalesce(p_depends_on,'{}'::uuid[]),coalesce(p_state,'{}'::jsonb),coalesce(p_next_run_at,now()))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.lia_enqueue_agent_mission(uuid,text,text,integer,uuid,uuid[],jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.lia_enqueue_agent_mission(uuid,text,text,integer,uuid,uuid[],jsonb,timestamptz) to service_role;

create or replace function public.lia_claim_agent_missions(p_limit integer default 5)
returns table(id uuid,user_id uuid,parent_id uuid,loop_run_id uuid,goal text,task text,priority integer,state jsonb,attempts integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return query
  with candidates as (
    select m.id from public.lia_agent_missions m
    where m.status in ('queued','waiting') and m.next_run_at <= now() and m.attempts < 100
      and not exists (
        select 1 from unnest(m.depends_on) d(id)
        left join public.lia_agent_missions dep on dep.id=d.id
        where dep.id is null or dep.status <> 'completed'
      )
    order by m.priority desc,m.next_run_at asc,m.created_at asc
    limit greatest(1,least(coalesce(p_limit,5),20)) for update skip locked
  )
  update public.lia_agent_missions m set status='running',attempts=m.attempts+1,updated_at=now()
  from candidates c where m.id=c.id
  returning m.id,m.user_id,m.parent_id,m.loop_run_id,m.goal,m.task,m.priority,m.state,m.attempts;
end; $$;
revoke all on function public.lia_claim_agent_missions(integer) from public,anon,authenticated;
grant execute on function public.lia_claim_agent_missions(integer) to service_role;

create or replace function public.lia_update_agent_mission(p_id uuid,p_status text,p_state jsonb default '{}',p_error text default null,p_next_run_at timestamptz default null,p_loop_run_id uuid default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.lia_agent_missions set status=case when p_status in ('queued','running','paused','waiting','completed','blocked','cancelled') then p_status else 'waiting' end,state=coalesce(p_state,'{}'::jsonb),last_error=left(p_error,1000),next_run_at=coalesce(p_next_run_at,next_run_at),loop_run_id=coalesce(p_loop_run_id,loop_run_id),updated_at=now() where id=p_id;
  return found;
end; $$;
revoke all on function public.lia_update_agent_mission(uuid,text,jsonb,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.lia_update_agent_mission(uuid,text,jsonb,text,timestamptz,uuid) to service_role;
