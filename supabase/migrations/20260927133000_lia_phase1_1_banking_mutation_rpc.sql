-- Phase 1.1: route financial-account state changes through ownership-checked RPCs.
-- Provider side effects remain in the API route; database state changes are governed here.

create or replace function public.lia_revoke_bank_account(
  p_account_id uuid,
  p_connection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  update public.bank_accounts ba
  set status = 'disabled',
      access_revoked_at = now(),
      updated_at = now()
  where ba.id = p_account_id
    and ba.connection_id = p_connection_id
    and ba.user_id = auth.uid();

  if not found then
    raise exception 'bank_account_not_found';
  end if;
end;
$$;

revoke all on function public.lia_revoke_bank_account(uuid,uuid)
  from public, anon;
grant execute on function public.lia_revoke_bank_account(uuid,uuid)
  to authenticated, service_role;


create or replace function public.lia_revoke_bank_connection(
  p_connection_id uuid,
  p_workspace_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if p_workspace_id is null then
    if not exists (
      select 1
      from public.bank_connections bc
      where bc.id = p_connection_id
        and bc.user_id = auth.uid()
        and bc.workspace_id is null
    ) then
      raise exception 'bank_connection_not_found';
    end if;

    update public.bank_accounts
    set status = 'revoked',
        access_revoked_at = now(),
        updated_at = now()
    where connection_id = p_connection_id
      and user_id = auth.uid();

    update public.bank_connections
    set status = 'revoked',
        updated_at = now()
    where id = p_connection_id
      and user_id = auth.uid()
      and workspace_id is null;

    return;
  end if;

  if not exists (
    select 1
    from public.financial_workspace_members fwm
    where fwm.workspace_id = p_workspace_id
      and fwm.user_id = auth.uid()
      and fwm.status = 'active'
      and fwm.role in ('owner','admin')
  ) then
    raise exception 'workspace_access_denied';
  end if;

  update public.bank_accounts
  set status = 'revoked',
      access_revoked_at = now(),
      updated_at = now()
  where connection_id = p_connection_id
    and workspace_id = p_workspace_id;

  update public.bank_connections
  set status = 'revoked',
      updated_at = now()
  where id = p_connection_id
    and workspace_id = p_workspace_id;
end;
$$;

revoke all on function public.lia_revoke_bank_connection(uuid,uuid)
  from public, anon;
grant execute on function public.lia_revoke_bank_connection(uuid,uuid)
  to authenticated, service_role;
