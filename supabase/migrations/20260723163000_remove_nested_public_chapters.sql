-- Public discovery exposes only top-level chapters. Remove child chapters that
-- were published before the projection began enforcing that hierarchy rule.
delete from public.published_chapters as chapter
using public.user_archives as archive
where archive.user_id = chapter.author_id
  and archive.payload #>> array['data', 'cubes', chapter.chapter_id, 'parentId'] is not null;
