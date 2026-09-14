alter table public.lia_runtime_controls add column if not exists ai_enabled boolean not null default true;
alter table public.lia_runtime_controls add column if not exists web_research_enabled boolean not null default true;
alter table public.lia_runtime_controls add column if not exists banking_refresh_enabled boolean not null default true;
alter table public.lia_runtime_controls add column if not exists cron_autonomy_enabled boolean not null default true;
update public.lia_runtime_controls set ai_enabled=true, web_research_enabled=true, banking_refresh_enabled=true, cron_autonomy_enabled=true where id=1;
