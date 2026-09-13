-- Gérer Finance: personnalisation utilisateur.
-- L'autorisation administrateur reste côté serveur via ADMIN_EMAILS;
-- cette table ne contient aucun rôle d'accès.
alter table public.profiles
  add column if not exists assistant_style text not null default 'normal',
  add column if not exists financial_goal text;

alter table public.profiles
  drop constraint if exists profiles_assistant_style_check;

alter table public.profiles
  add constraint profiles_assistant_style_check
  check (assistant_style in ('simple', 'normal', 'detaille'));
