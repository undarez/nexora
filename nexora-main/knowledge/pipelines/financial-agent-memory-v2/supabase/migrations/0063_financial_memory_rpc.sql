create or replace function public.financial_memory_last_validated_version(p_memory_id uuid)
returns public.financial_memory_versions
language sql stable
as $$
  select * from public.financial_memory_versions
  where memory_id = p_memory_id and status = 'validated'
  order by version desc limit 1;
$$;

create or replace function public.record_agent_behaviour_event(
  p_run_id uuid, p_step_id uuid, p_event_type text, p_severity text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.agent_behaviour_events
    (agent_loop_run_id, agent_loop_step_id, event_type, severity, metadata)
  values (p_run_id, p_step_id, p_event_type, p_severity, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;
