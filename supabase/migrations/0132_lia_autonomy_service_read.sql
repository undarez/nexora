-- Server-side autonomous loops use the service-role Supabase client.
-- Keep the user-facing get_lia_autonomy RPC self-scoped, while allowing trusted
-- server execution to read the configured ceiling for the explicitly supplied user.
create or replace function public.get_lia_autonomy(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v integer;
begin
  if p_user_id is null then raise exception 'forbidden'; end if;
  if auth.role() <> 'service_role' and p_user_id <> auth.uid() then
    raise exception 'forbidden';
  end if;
  select max_autonomy_level into v
  from public.lia_autonomy_profiles
  where user_id=p_user_id;
  return coalesce(v,1);
end;
$$;

revoke all on function public.get_lia_autonomy(uuid) from public,anon;
grant execute on function public.get_lia_autonomy(uuid) to authenticated,service_role;
