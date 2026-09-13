-- V5.09.01 — production runtime metrics. Privacy-minimized operational telemetry.
alter table public.lia_production_telemetry
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column if not exists input_chars integer check (input_chars is null or input_chars >= 0),
  add column if not exists output_chars integer check (output_chars is null or output_chars >= 0),
  add column if not exists generated_tokens integer check (generated_tokens is null or generated_tokens >= 0),
  add column if not exists tokens_per_second numeric check (tokens_per_second is null or tokens_per_second >= 0),
  add column if not exists estimated_cost_cents numeric check (estimated_cost_cents is null or estimated_cost_cents >= 0);

create index if not exists idx_lia_production_telemetry_provider_time
  on public.lia_production_telemetry(provider, created_at desc);

comment on column public.lia_production_telemetry.estimated_cost_cents is 'Optional operator estimate only; calculated from configured rates and never treated as a billing truth.';
