-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────────────────
create table profiles (
  id              uuid references auth.users on delete cascade primary key,
  email           text not null,
  display_name    text not null default 'Player',
  avatar_initials text not null default 'PL',
  avatar_color    text not null default '#1e3a2e',
  created_at      timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view all profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name, avatar_initials)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    upper(substring(split_part(new.email, '@', 1), 1, 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── GROUPS ────────────────────────────────────────────────────────────
create table groups (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  created_by  uuid references profiles(id) on delete cascade not null,
  created_at  timestamptz default now()
);

alter table groups enable row level security;
create policy "Group members can view groups" on groups for select
  using (exists (
    select 1 from group_members
    where group_members.group_id = groups.id
    and group_members.user_id = auth.uid()
  ));
create policy "Authenticated users can create groups" on groups for insert
  with check (auth.uid() = created_by);
create policy "Group creator can update" on groups for update
  using (auth.uid() = created_by);

-- ── GROUP MEMBERS ──────────────────────────────────────────────────────
create table group_members (
  group_id  uuid references groups(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_members enable row level security;
create policy "Members can view group membership" on group_members for select using (true);
create policy "Users can join groups" on group_members for insert
  with check (auth.uid() = user_id);
create policy "Users can leave groups" on group_members for delete
  using (auth.uid() = user_id);

-- ── MATCHES ────────────────────────────────────────────────────────────
create table matches (
  id          text primary key,
  group_label text not null,
  match_number int not null,
  home_team   text not null,
  away_team   text not null,
  home_flag   text not null,
  away_flag   text not null,
  home_score  int,
  away_score  int,
  kickoff     timestamptz not null,
  venue       text not null,
  city        text not null,
  status      text not null default 'upcoming' check (status in ('upcoming','live','finished')),
  minute      int
);

alter table matches enable row level security;
create policy "Anyone can read matches" on matches for select using (true);
create policy "Only service role can update matches" on matches for update
  using (auth.role() = 'service_role');

-- ── PREDICTIONS ────────────────────────────────────────────────────────
create table predictions (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  match_id    text references matches(id) on delete cascade not null,
  home_score  int not null check (home_score >= 0),
  away_score  int not null check (away_score >= 0),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, match_id)
);

alter table predictions enable row level security;
create policy "Users can view all predictions" on predictions for select using (true);
create policy "Users can insert own predictions" on predictions for insert
  with check (auth.uid() = user_id);
create policy "Users can update own predictions" on predictions for update
  using (auth.uid() = user_id);

-- ── BRACKET PICKS ──────────────────────────────────────────────────────
create table bracket_picks (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  round       text not null check (round in ('r16','qf','sf','final','champion')),
  slot_index  int not null,
  team_code   text not null,
  created_at  timestamptz default now(),
  unique(user_id, round, slot_index)
);

alter table bracket_picks enable row level security;
create policy "Users can view all bracket picks" on bracket_picks for select using (true);
create policy "Users can manage own picks" on bracket_picks for insert
  with check (auth.uid() = user_id);
create policy "Users can update own picks" on bracket_picks for update
  using (auth.uid() = user_id);

-- ── SCORES (computed/cached) ───────────────────────────────────────────
create table scores (
  user_id         uuid references profiles(id) on delete cascade,
  group_id        uuid references groups(id) on delete cascade,
  total_points    int not null default 0,
  exact_scores    int not null default 0,
  correct_results int not null default 0,
  streak          int not null default 0,
  updated_at      timestamptz default now(),
  primary key (user_id, group_id)
);

alter table scores enable row level security;
create policy "Anyone can view scores" on scores for select using (true);
create policy "Service role can upsert scores" on scores for all
  using (auth.role() = 'service_role');

-- ── REALTIME ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table predictions;