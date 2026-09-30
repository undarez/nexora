-- LIA runtime scheduler is hosted by Supabase Cron so Vercel Hobby can remain on its daily cron limits.
-- The scheduler invokes the existing protected Next.js runtime endpoint through pg_net.
-- Endpoint URL and bearer secret are stored in Supabase Vault and are intentionally not committed.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create or replace function public.lia_runtime_scheduler_tick()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog, vault, net
as $$
declare
  runtime_url text;
  runtime_secret text;
  request_id bigint;
begin
  select decrypted_secret into runtime_url
  from vault.decrypted_secrets
  where name = 'lia_runtime_url'
  limit 1;

  select decrypted_secret into runtime_secret
  from vault.decrypted_secrets
  where name = 'lia_runtime_cron_secret'
  limit 1;

  -- Safe no-op until the deployment URL and cron secret are configured in Vault.
  if nullif(trim(coalesce(runtime_url, '')), '') is null
     or nullif(trim(coalesce(runtime_secret, '')), '') is null then
    return null;
  end if;

  select net.http_post(
    url := runtime_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || runtime_secret
    ),
    body := jsonb_build_object(
      'source', 'supabase_cron',
      'scheduled_at', now()
    ),
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.lia_runtime_scheduler_tick() from public;
grant execute on function public.lia_runtime_scheduler_tick() to postgres;

select cron.schedule(
  'lia-runtime-hourly',
  '0 * * * *',
  $$select public.lia_runtime_scheduler_tick();$$
)
where not exists (
  select 1 from cron.job where jobname = 'lia-runtime-hourly'
);

comment on function public.lia_runtime_scheduler_tick() is
  'Hourly LIA runtime trigger. Uses Supabase Cron + pg_net and Vault; does not grant the model any additional authority.';
