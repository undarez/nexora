-- v4.67: adaptive procedural learning. Experiences can create candidates; nothing is auto-validated or activated.
create index if not exists idx_lia_learning_abstraction_outcome
  on public.lia_learning_records(user_id, abstraction, memory_gate, created_at desc);

comment on table public.lia_learning_records is 'Experiences and corrections retained as candidate knowledge. Never model-weight updates; never automatic skill activation.';
