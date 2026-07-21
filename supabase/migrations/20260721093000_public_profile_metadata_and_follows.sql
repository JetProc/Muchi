-- Public discovery uses a denormalized projection. Keep only public-facing profile
-- metadata beside each chapter so private profile rows remain private.
alter table public.profiles
add column if not exists bio text not null default '' check (char_length(bio) <= 160);

alter table public.published_chapters
add column if not exists author_avatar_url text,
add column if not exists author_bio text not null default '' check (char_length(author_bio) <= 160);

update public.published_chapters as chapter
set author_name = profile.display_name,
    author_avatar_url = profile.avatar_url,
    author_bio = profile.bio
from public.profiles as profile
where profile.id = chapter.author_id
  and profile.profile_setup_completed;

create table if not exists public.profile_follows (
  profile_id uuid not null references auth.users(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, follower_id),
  check (profile_id <> follower_id)
);

create table if not exists public.profile_follow_counts (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  follower_count integer not null default 0 check (follower_count >= 0),
  updated_at timestamptz not null default now()
);

insert into public.profile_follow_counts (profile_id, follower_count)
select profile_id, count(*)::integer
from public.profile_follows
group by profile_id
on conflict (profile_id) do update
set follower_count = excluded.follower_count,
    updated_at = now();

create index if not exists profile_follows_follower_idx on public.profile_follows (follower_id, created_at desc);

alter table public.profile_follows enable row level security;
alter table public.profile_follow_counts enable row level security;

grant select, insert, delete on public.profile_follows to authenticated;
grant select on public.profile_follow_counts to anon, authenticated;

create policy "users can read their own profile follows"
on public.profile_follows for select to authenticated
using ((select auth.uid()) = follower_id);

create policy "users can follow profiles themselves"
on public.profile_follows for insert to authenticated
with check ((select auth.uid()) = follower_id and profile_id <> follower_id);

create policy "users can unfollow profiles themselves"
on public.profile_follows for delete to authenticated
using ((select auth.uid()) = follower_id);

create policy "public can read profile follower counts"
on public.profile_follow_counts for select to anon, authenticated
using (true);

create or replace function public.sync_profile_follow_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_follow_counts (profile_id, follower_count)
    values (new.profile_id, 1)
    on conflict (profile_id) do update
    set follower_count = public.profile_follow_counts.follower_count + 1,
        updated_at = now();
    return new;
  end if;

  update public.profile_follow_counts
  set follower_count = greatest(follower_count - 1, 0),
      updated_at = now()
  where profile_id = old.profile_id;
  return old;
end;
$$;

revoke execute on function public.sync_profile_follow_count() from public, anon, authenticated;

drop trigger if exists profile_follows_sync_count on public.profile_follows;
create trigger profile_follows_sync_count
after insert or delete on public.profile_follows
for each row execute procedure public.sync_profile_follow_count();

drop policy if exists "authenticated users can read published chapters" on public.published_chapters;
grant select on public.published_chapters to anon, authenticated;
create policy "public can read published chapters"
on public.published_chapters for select to anon, authenticated
using (true);
