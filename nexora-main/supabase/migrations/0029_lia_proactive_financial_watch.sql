-- Gérer Finance v4.59 — Proactive Financial Watch
-- Deterministic signals may create notifications through a server-only
-- SECURITY DEFINER function. Client roles cannot insert notifications directly.

create or replace function public.publish_financial_watch_notifications(
  p_user_id uuid,
  p_signals jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  inserted_count integer := 0;
  severity text;
  title text;
  message text;
  href text;
  signal_id text;
begin
  if uid is null or uid <> p_user_id then
    raise exception 'financial_watch_forbidden' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_signals, '[]'::jsonb)) <> 'array' then
    raise exception 'financial_watch_invalid_payload' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_signals) where jsonb_typeof(value) = 'object' limit 8 loop
    signal_id := left(coalesce(item->>'id',''), 160);
    severity := case when item->>'severity' in ('info','warning','danger') then item->>'severity' else 'info' end;
    title := left(coalesce(item->>'title','Surveillance financière'), 160);
    message := left(coalesce(item->>'message','Un nouveau signal financier nécessite votre attention.'), 500);
    href := case when left(coalesce(item->>'actionHref',''), 1) = '/' then left(item->>'actionHref', 200) else '/pilotage' end;

    if signal_id <> '' then
      insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
      values (
        uid,
        'system',
        severity,
        title,
        message,
        href,
        'financial-watch:' || signal_id
      )
      on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
      if found then inserted_count := inserted_count + 1; end if;
    end if;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.publish_financial_watch_notifications(uuid,jsonb) from public;
revoke execute on function public.publish_financial_watch_notifications(uuid,jsonb) from anon;
grant execute on function public.publish_financial_watch_notifications(uuid,jsonb) to authenticated;
