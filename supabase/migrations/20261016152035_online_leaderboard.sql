create table public.leaderboard_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 14 and display_name !~ '[[:cntrl:]]'),
  difficulty text not null check (difficulty in ('easy','normal','hard','expert','hell')),
  mode text not null check (mode in ('solo','coop')),
  score integer not null check (score > 0),
  wave integer not null check (wave between 1 and 100000),
  kills integer not null check (kills between 0 and 100000000),
  created_at timestamptz not null default now(),
  primary key (user_id, run_id)
);
create index leaderboard_top on public.leaderboard_scores (difficulty, mode, score desc, wave desc, created_at asc);
alter table public.leaderboard_scores enable row level security;
revoke all on public.leaderboard_scores from anon, authenticated;
grant select on public.leaderboard_scores to anon, authenticated;
grant insert (user_id,run_id,display_name,difficulty,mode,score,wave,kills) on public.leaderboard_scores to authenticated;
create policy leaderboard_public_read on public.leaderboard_scores for select to anon, authenticated using (true);
create policy leaderboard_own_insert on public.leaderboard_scores for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false');
comment on table public.leaderboard_scores is 'Casual client-reported runs. Account ownership is enforced; scores are not authoritative simulation results. No email or account secrets are stored here.';
