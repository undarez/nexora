-- NEXORA v5.07.3: Financial Secure Vault L3.
-- Raw sensitive payloads are encrypted application-side and never exposed to browser/LIA.
create table if not exists public.financial_secure_vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  data_class text not null check (data_class in ('bank_account','bank_connection','payment_instrument','identity_document','other_sensitive')),
  sensitivity_level integer not null default 3 check (sensitivity_level between 3 and 5),
  label text not null,
  masked_label text not null,
  provider_ref text,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  status text not null default 'active' check (status in ('active','revoked','quarantined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);
create index if not exists financial_secure_vault_items_user_status_idx on public.financial_secure_vault_items(user_id,status,updated_at desc);
alter table public.financial_secure_vault_items enable row level security;
drop policy if exists financial_secure_vault_items_owner on public.financial_secure_vault_items;
create policy financial_secure_vault_items_owner on public.financial_secure_vault_items for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
comment on table public.financial_secure_vault_items is 'L3 secure vault. Application-encrypted payload; raw secret material must never be returned to browser or LIA.';
