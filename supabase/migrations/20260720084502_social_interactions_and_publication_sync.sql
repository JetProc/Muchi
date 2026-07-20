create table public.chapter_likes (
  author_id uuid not null,
  chapter_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (author_id, chapter_id, user_id),
  foreign key (author_id, chapter_id)
    references public.published_chapters(author_id, chapter_id)
    on delete cascade
);

create index chapter_likes_chapter_idx on public.chapter_likes (author_id, chapter_id);

alter table public.published_chapters
add column if not exists like_count integer not null default 0 check (like_count >= 0);

alter table public.chapter_likes enable row level security;
grant select, insert, delete on public.chapter_likes to authenticated;

create policy "users can read their own chapter likes"
on public.chapter_likes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users can add their own chapter likes"
on public.chapter_likes for insert to authenticated
with check ((select auth.uid()) = user_id and (select auth.uid()) <> author_id);

create policy "users can remove their own chapter likes"
on public.chapter_likes for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.sync_published_chapter_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.published_chapters
    set like_count = like_count + 1
    where author_id = new.author_id and chapter_id = new.chapter_id;
    return new;
  end if;

  update public.published_chapters
  set like_count = greatest(like_count - 1, 0)
  where author_id = old.author_id and chapter_id = old.chapter_id;
  return old;
end;
$$;

revoke execute on function public.sync_published_chapter_like_count() from public, anon, authenticated;

create trigger chapter_likes_sync_published_count
after insert or delete on public.chapter_likes
for each row execute procedure public.sync_published_chapter_like_count();
