-- Phase 1.1: harden the skill release control plane and system rollback ledger.
-- The HTTP release surface is an admin control-plane operation. Direct client
-- execution of the legacy authenticated RPC is removed; the server route uses
-- a service-role wrapper after performing the application-level admin check.

revoke execute on function public.lia_skill_release_transition(uuid, text, text)
  from public, anon, authenticated;

alter function public.lia_skill_release_transition(uuid, text, text)
  set search_path = '';

create or replace function public.lia_skill_release_transition_admin(
  p_candidate_id uuid,
  p_action text,
  p_reason text default null,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_actor is null then
    raise exception 'control_plane_actor_required';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_actor
  ) then
    raise exception 'control_plane_actor_not_found';
  end if;

  -- Reuse the already-audited ownership/state machine without duplicating it.
  -- Claims are transaction-local and exist only for the delegated call.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );

  result := public.lia_skill_release_transition(
    p_candidate_id,
    p_action,
    p_reason
  );

  return result;
end;
$$;

revoke all on function public.lia_skill_release_transition_admin(uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.lia_skill_release_transition_admin(uuid, text, text, uuid)
  to service_role;

-- Automatic canary rollback is a system control-plane event. The activation
-- ledger must therefore permit a null human actor while actor_type remains
-- explicitly "system" in lia_skill_release_events.
alter table public.lia_skill_activations
  alter column activated_by drop not null;

comment on column public.lia_skill_activations.activated_by is
  'Human actor for manual activation/release; NULL is permitted for system-triggered rollback/restoration events.';

-- Defense-in-depth: the existing governed activation RPCs remain server-only.
revoke all on function public.lia_governed_activate_skill(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.lia_governed_activate_skill(uuid, uuid, text)
  to service_role;

revoke all on function public.lia_governed_rollback_skill(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.lia_governed_rollback_skill(uuid, uuid, text)
  to service_role;
