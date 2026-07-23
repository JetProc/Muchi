-- Successful saves only need the next revision: the browser already keeps the
-- validated optimistic archive. Full payloads remain available for conflicts.
create or replace function public.save_archive_with_public_projection(
  p_payload jsonb,
  p_schema_version integer,
  p_expected_revision bigint,
  p_sync_public_projection boolean,
  p_projection jsonb default '[]'::jsonb,
  p_author_name text default null,
  p_author_avatar_url text default null,
  p_author_bio text default null
)
returns table(status text, payload jsonb, revision bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;

  update public.user_archives
  set payload = p_payload,
      schema_version = p_schema_version,
      revision = p_expected_revision + 1
  where user_id = actor_id
    and revision = p_expected_revision;

  if not found then
    return query
    select 'conflict'::text, archive.payload, archive.revision
    from public.user_archives as archive
    where archive.user_id = actor_id;
    return;
  end if;

  if p_sync_public_projection then
    if p_author_name is null or p_author_bio is null then
      raise exception 'public author profile is required';
    end if;

    delete from public.published_chapters as chapter
    where chapter.author_id = actor_id
      and not exists (
        select 1
        from jsonb_to_recordset(p_projection) as projection(chapter_id text)
        where projection.chapter_id = chapter.chapter_id
      );

    insert into public.published_chapters (
      author_id,
      chapter_id,
      author_name,
      author_avatar_url,
      author_bio,
      payload,
      published_at
    )
    select
      actor_id,
      projection.chapter_id,
      p_author_name,
      p_author_avatar_url,
      p_author_bio,
      projection.payload,
      projection.published_at
    from jsonb_to_recordset(p_projection) as projection(
      chapter_id text,
      payload jsonb,
      published_at timestamptz
    )
    on conflict (author_id, chapter_id) do update
    set author_name = excluded.author_name,
        author_avatar_url = excluded.author_avatar_url,
        author_bio = excluded.author_bio,
        payload = excluded.payload,
        published_at = excluded.published_at;
  end if;

  return query select 'ok'::text, null::jsonb, p_expected_revision + 1;
end;
$$;

grant execute on function public.save_archive_with_public_projection(
  jsonb, integer, bigint, boolean, jsonb, text, text, text
) to authenticated;
