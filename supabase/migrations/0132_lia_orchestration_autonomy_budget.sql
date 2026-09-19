create table if not exists public.lia_orchestration_budgets (
  run_id uuid primary key references public.lia_orchestration_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  max_steps integer not null default 5 check (max_steps between 1 and 50),
  max_tool_calls integer not null default 8 check (max_tool_calls between 0 and 100),
  max_retries integer not null default 4 check (max_retries between 0 and 50),
  max_replans integer not null default 2 check (max_replans between 0 and 10),
  max_research_requests integer not null default 3 check (max_research_requests between 0 and 50),
  max_memory_writes integer not null default 5 check (max_memory_writes between 0 and 50),
  max_runtime_ms integer not null default 30000 check (max_runtime_ms between 1000 and 300000),
  used_steps integer not null default 0,
  used_tool_calls integer not null default 0,
  used_retries integer not null default 0,
  used_replans integer not null default 0,
  used_research_requests integer not null default 0,
  used_memory_writes integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lia_orchestration_budgets_user
  on public.lia_orchestration_budgets(user_id, updated_at desc);

alter table public.lia_orchestration_budgets enable row level security;
revoke all on public.lia_orchestration_budgets from anon, authenticated;
grant select on public.lia_orchestration_budgets to service_role;

create or replace function public.lia_consume_orchestration_budget(
  p_run_id uuid, p_user_id uuid, p_dimension text, p_amount integer default 1
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.lia_orchestration_budgets; used_value integer; max_value integer;
begin
  if p_amount < 1 then raise exception 'budget_amount_must_be_positive'; end if;
  select * into r from public.lia_orchestration_budgets where run_id=p_run_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('allowed',false,'reason','budget_not_initialized'); end if;
  used_value := case p_dimension when 'steps' then r.used_steps when 'tool_calls' then r.used_tool_calls when 'retries' then r.used_retries when 'replans' then r.used_replans when 'research_requests' then r.used_research_requests when 'memory_writes' then r.used_memory_writes else -1 end;
  max_value := case p_dimension when 'steps' then r.max_steps when 'tool_calls' then r.max_tool_calls when 'retries' then r.max_retries when 'replans' then r.max_replans when 'research_requests' then r.max_research_requests when 'memory_writes' then r.max_memory_writes else -1 end;
  if used_value < 0 or max_value < 0 then return jsonb_build_object('allowed',false,'reason','unknown_budget_dimension','dimension',p_dimension); end if;
  if used_value + p_amount > max_value then return jsonb_build_object('allowed',false,'reason','budget_exhausted','dimension',p_dimension,'used',used_value,'limit',max_value,'requested',p_amount); end if;
  if p_dimension='steps' then r.used_steps:=r.used_steps+p_amount;
  elsif p_dimension='tool_calls' then r.used_tool_calls:=r.used_tool_calls+p_amount;
  elsif p_dimension='retries' then r.used_retries:=r.used_retries+p_amount;
  elsif p_dimension='replans' then r.used_replans:=r.used_replans+p_amount;
  elsif p_dimension='research_requests' then r.used_research_requests:=r.used_research_requests+p_amount;
  elsif p_dimension='memory_writes' then r.used_memory_writes:=r.used_memory_writes+p_amount;
  end if;
  update public.lia_orchestration_budgets set used_steps=r.used_steps,used_tool_calls=r.used_tool_calls,used_retries=r.used_retries,used_replans=r.used_replans,used_research_requests=r.used_research_requests,used_memory_writes=r.used_memory_writes,updated_at=now() where run_id=p_run_id;
  return jsonb_build_object('allowed',true,'dimension',p_dimension,'used',used_value+p_amount,'limit',max_value,'remaining',max_value-used_value-p_amount);
end;
$$;

revoke all on function public.lia_consume_orchestration_budget(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.lia_consume_orchestration_budget(uuid,uuid,text,integer) to service_role;
