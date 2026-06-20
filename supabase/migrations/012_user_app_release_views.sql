create table if not exists user_app_release_views (
  user_id uuid references profiles(id) on delete cascade not null,
  release_version text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, release_version)
);

alter table user_app_release_views enable row level security;

drop policy if exists "Users can view own release views" on user_app_release_views;
create policy "Users can view own release views"
  on user_app_release_views for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own release views" on user_app_release_views;
create policy "Users can insert own release views"
  on user_app_release_views for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own release views" on user_app_release_views;
create policy "Users can update own release views"
  on user_app_release_views for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
