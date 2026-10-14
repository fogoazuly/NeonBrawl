create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null check (jsonb_typeof(progress) = 'object' and octet_length(progress::text) <= 262144),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.player_progress enable row level security;
revoke all on public.player_progress from anon, authenticated;
grant select, insert, update on public.player_progress to authenticated;
create policy progress_read on public.player_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy progress_insert on public.player_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy progress_update on public.player_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.stamp_player_progress() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.stamp_player_progress() from public, anon, authenticated;
create trigger stamp_player_progress before update on public.player_progress
for each row execute function public.stamp_player_progress();
