-- v5.04: bounded action lifecycle. Execution is claim-once, observable and verifiable.
alter table public.lia_action_proposals
  add column if not exists claimed_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists execution_attempts integer not null default 0;

alter table public.lia_action_proposals drop constraint if exists lia_action_proposals_status_check;
alter table public.lia_action_proposals
  add constraint lia_action_proposals_status_check
  check (status in ('proposed','approved','executing','rejected','executed','rolled_back','expired','failed'));

create index if not exists idx_lia_action_proposals_lifecycle
  on public.lia_action_proposals(user_id,status,created_at desc);

-- Atomic claim prevents two requests from executing the same approved proposal.
create or replace function public.claim_lia_action_for_execution(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.lia_action_proposals%rowtype;
begin
  select * into p from public.lia_action_proposals
  where id=p_proposal_id and user_id=auth.uid() for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if p.status <> 'approved' then raise exception 'proposal_not_approved'; end if;
  if p.expires_at is not null and p.expires_at < now() then
    update public.lia_action_proposals set status='expired' where id=p.id;
    insert into public.lia_action_audit(proposal_id,user_id,agent_id,event,actor,metadata)
      values(p.id,p.user_id,p.agent_id,'expired','system',jsonb_build_object('stage','claim'));
    raise exception 'proposal_expired';
  end if;
  update public.lia_action_proposals
    set status='executing', claimed_at=now(), execution_attempts=execution_attempts+1
    where id=p.id;
  insert into public.lia_action_audit(proposal_id,user_id,agent_id,event,actor,metadata)
    values(p.id,p.user_id,p.agent_id,'execution_claimed','human_approved',jsonb_build_object('attempt',p.execution_attempts+1));
  return jsonb_build_object('id',p.id,'status','executing','execution_attempts',p.execution_attempts+1);
end; $$;
revoke all on function public.claim_lia_action_for_execution(uuid) from public,anon;
grant execute on function public.claim_lia_action_for_execution(uuid) to authenticated;

comment on table public.lia_action_proposals is 'Bounded LIA lifecycle: proposed -> approved -> executing -> executed/failed -> optionally rolled_back. Execution is atomic-claimed and separately verified.';
comment on column public.lia_action_proposals.execution_attempts is 'Number of atomic execution claims; used to prevent ambiguous repeated execution.';
