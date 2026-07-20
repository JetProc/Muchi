create table public.published_chapters (
  author_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  author_name text not null,
  payload jsonb not null,
  published_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (author_id, chapter_id)
);

create index published_chapters_feed_idx on public.published_chapters (published_at desc);
create index published_chapters_author_idx on public.published_chapters (author_id, published_at desc);

create trigger published_chapters_set_updated_at
before update on public.published_chapters
for each row execute procedure public.set_updated_at();

alter table public.published_chapters enable row level security;
grant select, insert, update, delete on public.published_chapters to authenticated;

create policy "authenticated users can read published chapters"
on public.published_chapters for select to authenticated
using (true);

create policy "users manage their own published chapters"
on public.published_chapters for all to authenticated
using ((select auth.uid()) = author_id)
with check ((select auth.uid()) = author_id);
