create table if not exists nexus_links (
  id text primary key,
  user_id text not null,
  provider text not null,
  label text not null default '',
  status text not null default 'off',
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists lucid_campaigns (
  id text primary key,
  user_id text not null,
  name text not null,
  channel text not null,
  status text not null,
  spend integer not null default 0,
  goal text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists lucid_campaigns_user on lucid_campaigns (user_id);

create table if not exists veriton_tracks (
  id text primary key,
  user_id text not null,
  title text not null,
  mood text not null,
  stage text not null,
  updated_at timestamptz not null default now()
);
create index if not exists veriton_tracks_user on veriton_tracks (user_id);

create table if not exists omni_searches (
  id text primary key,
  user_id text not null,
  query text not null,
  created_at timestamptz not null default now()
);
create index if not exists omni_searches_user on omni_searches (user_id, created_at desc);
