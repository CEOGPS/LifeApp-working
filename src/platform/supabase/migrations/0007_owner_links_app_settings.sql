-- 0007_owner_links_app_settings.sql
-- Owner-stable data for LifeOS (additive, non-destructive).
--
-- Problem: the app signs in anonymously. If the browser loses its session a new
-- anonymous uid is created and RLS (user_id = auth.uid()) hides the old rows.
-- Fix: every anonymous session can be LINKED to one stable owner uid. RLS then
-- checks user_id = app_owner_id() (linked owner, else auth.uid()).
-- Linking only happens through claim_owner(code), where code is a secret owner
-- code whose SHA-256 is stored in owner_claim_codes (no direct table access).
-- Existing keys policies are left in place; new owner policies are ADDED.

create table if not exists public.owner_links (
  member_uid uuid primary key,
  owner_uid  uuid not null,
  linked_at  timestamptz not null default now()
);
alter table public.owner_links enable row level security;
drop policy if exists owner_links_select_self on public.owner_links;
create policy owner_links_select_self on public.owner_links
  for select to authenticated using (member_uid = (select auth.uid()));

create table if not exists public.owner_claim_codes (
  owner_uid  uuid primary key,
  code_hash  text not null unique,
  created_at timestamptz not null default now()
);
alter table public.owner_claim_codes enable row level security;
-- no policies: only reachable through the security-definer functions below

create or replace function public.app_owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select l.owner_uid from public.owner_links l where l.member_uid = auth.uid()),
    auth.uid()
  );
$$;

create or replace function public.claim_owner(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_code is null or length(p_code) < 16 then raise exception 'invalid owner code'; end if;
  select c.owner_uid into v_owner from public.owner_claim_codes c
   where c.code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
  if v_owner is null then raise exception 'invalid owner code'; end if;
  if v_owner <> auth.uid() then
    insert into public.owner_links(member_uid, owner_uid) values (auth.uid(), v_owner)
    on conflict (member_uid) do update set owner_uid = excluded.owner_uid, linked_at = now();
  end if;
  return v_owner;
end $$;

-- Lets the effective owner set/rotate their owner code (min 16 chars).
create or replace function public.set_owner_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_code is null or length(p_code) < 16 then raise exception 'owner code must be at least 16 characters'; end if;
  insert into public.owner_claim_codes(owner_uid, code_hash)
  values (public.app_owner_id(), encode(sha256(convert_to(p_code, 'UTF8')), 'hex'))
  on conflict (owner_uid) do update set code_hash = excluded.code_hash, created_at = now();
end $$;

revoke all on function public.claim_owner(text) from public, anon;
revoke all on function public.set_owner_code(text) from public, anon;
grant execute on function public.claim_owner(text) to authenticated;
grant execute on function public.set_owner_code(text) to authenticated;
grant execute on function public.app_owner_id() to authenticated;

-- keys: ADD owner-aware policies (existing *_own policies untouched)
drop policy if exists keys_select_owner on public.keys;
drop policy if exists keys_insert_owner on public.keys;
drop policy if exists keys_update_owner on public.keys;
drop policy if exists keys_delete_owner on public.keys;
create policy keys_select_owner on public.keys for select to authenticated
  using (user_id = (select public.app_owner_id()));
create policy keys_insert_owner on public.keys for insert to authenticated
  with check (user_id = (select public.app_owner_id()));
create policy keys_update_owner on public.keys for update to authenticated
  using (user_id = (select public.app_owner_id()))
  with check (user_id = (select public.app_owner_id()));
create policy keys_delete_owner on public.keys for delete to authenticated
  using (user_id = (select public.app_owner_id()));

-- app_settings: owner-scoped JSON settings (banner, logo, Erebus dock, ...)
create table if not exists public.app_settings (
  owner_id   uuid not null,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_owner_all on public.app_settings;
create policy app_settings_owner_all on public.app_settings for all to authenticated
  using (owner_id = (select public.app_owner_id()))
  with check (owner_id = (select public.app_owner_id()));
grant select, insert, update, delete on public.app_settings to authenticated;
