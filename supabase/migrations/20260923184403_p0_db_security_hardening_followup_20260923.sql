-- Follow-up to P0 DB security hardening.
-- The governance hash function uses pgcrypto's digest(), which lives in the
-- extensions schema; the explicit qualification is required with search_path=''.
create or replace function public.append_lia_governance_audit(
  p_user_id uuid, p_event_type text, p_actor text, p_correlation_id text,
  p_source_refs jsonb default '{}'::jsonb, p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  prev text;
  new_id uuid := gen_random_uuid();
  created timestamptz := now();
  payload text;
  h text;
begin
  if p_user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if p_event_type is null or length(trim(p_event_type))=0 or length(p_event_type)>120 then raise exception 'invalid_event_type'; end if;
  if p_actor not in ('user','lia','system') then raise exception 'invalid_actor'; end if;
  select event_hash into prev
    from public.lia_governance_audit
    where user_id=p_user_id
    order by created_at desc,id desc limit 1;
  payload := coalesce(prev,'')||'|'||new_id::text||'|'||p_user_id::text||'|'||
    p_event_type||'|'||p_actor||'|'||coalesce(p_correlation_id,'')||'|'||
    coalesce(p_source_refs,'{}'::jsonb)::text||'|'||
    coalesce(p_metadata,'{}'::jsonb)::text||'|'||created::text;
  h := encode(extensions.digest(payload,'sha256'),'hex');
  insert into public.lia_governance_audit(
    id,user_id,event_type,actor,correlation_id,source_refs,metadata,
    previous_hash,event_hash,created_at
  ) values(
    new_id,p_user_id,p_event_type,p_actor,p_correlation_id,
    coalesce(p_source_refs,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb),
    prev,h,created
  );
  return jsonb_build_object('id',new_id,'event_hash',h,'previous_hash',prev,'created_at',created);
end;
$function$;
