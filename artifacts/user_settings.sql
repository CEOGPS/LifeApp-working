-- Free tier. One row per user per key. RLS so a login only sees its own rows.
create table if not exists public.user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_settings enable row level security;

create policy "own rows" on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
