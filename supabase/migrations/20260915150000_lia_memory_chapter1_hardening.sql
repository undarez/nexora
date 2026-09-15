-- Chapter 1: durable memory performance + deterministic expiry reconciliation.
create index if not exists idx_lia_memory_user_status_created on public.lia_memory(user_id, status, created_at desc);
create index if not exists idx_lia_memory_user_type_topic on public.lia_memory(user_id, memory_type, topic);
create index if not exists idx_lia_memory_expiry on public.lia_memory(user_id, expires_at) where expires_at is not null;
create index if not exists idx_lia_learning_records_user_created on public.lia_learning_records(user_id, created_at desc);
create index if not exists idx_lia_memory_curation_user_created on public.lia_memory_curation_runs(user_id, created_at desc);

update public.lia_memory
set status='stale', updated_at=now()
where status='accepted' and expires_at is not null and expires_at <= now();
