alter table public.profiles
add column if not exists avatar_url text,
add column if not exists profile_setup_completed boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_archives_payload_size_check'
      and conrelid = 'public.user_archives'::regclass
  ) then
    alter table public.user_archives
    add constraint user_archives_payload_size_check
    check (octet_length(payload::text) <= 4000000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'discovery_states_payload_size_check'
      and conrelid = 'public.discovery_states'::regclass
  ) then
    alter table public.discovery_states
    add constraint discovery_states_payload_size_check
    check (octet_length(payload::text) <= 256000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'published_chapters_payload_size_check'
      and conrelid = 'public.published_chapters'::regclass
  ) then
    alter table public.published_chapters
    add constraint published_chapters_payload_size_check
    check (octet_length(payload::text) <= 4000000);
  end if;
end $$;

update public.profiles as profile
set avatar_url = coalesce(
  nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
  nullif(users.raw_user_meta_data ->> 'picture', '')
)
from auth.users as users
where users.id = profile.id
  and profile.avatar_url is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_completed_nickname_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_completed_nickname_check check (
      not profile_setup_completed
      or (
        char_length(display_name) between 2 and 20
        and display_name = btrim(display_name)
        and display_name !~ '  '
        and display_name ~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]+$'
      )
    );
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    '',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop policy if exists "profiles are private to their owner" on public.profiles;
create policy "profiles are private to their owner"
on public.profiles for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "archives are private to their owner" on public.user_archives;
create policy "archives are private to their owner"
on public.user_archives for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "discovery state is private to its owner" on public.discovery_states;
create policy "discovery state is private to its owner"
on public.discovery_states for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users manage their own published chapters" on public.published_chapters;

create policy "users insert their own published chapters"
on public.published_chapters for insert to authenticated
with check ((select auth.uid()) = author_id);

create policy "users update their own published chapters"
on public.published_chapters for update to authenticated
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);

create policy "users delete their own published chapters"
on public.published_chapters for delete to authenticated
using ((select auth.uid()) = author_id);
