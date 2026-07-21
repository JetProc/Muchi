-- Add the optional, chapter-specific track affection field to persisted archives.
-- Incrementing revision makes any stale v8 browser session reload before it can save.
update public.user_archives
set
  payload = jsonb_set(
    jsonb_set(payload, '{schemaVersion}', '9'::jsonb, true),
    '{data,cubeTracks}',
    coalesce(
      (
        select jsonb_object_agg(
          cube_track_id,
          jsonb_set(cube_track, '{affection}', coalesce(cube_track -> 'affection', 'null'::jsonb), true)
        )
        from jsonb_each(coalesce(payload #> '{data,cubeTracks}', '{}'::jsonb))
          as cube_tracks(cube_track_id, cube_track)
      ),
      '{}'::jsonb
    ),
    true
  ),
  schema_version = 9,
  revision = revision + 1
where schema_version < 9
   or payload ->> 'schemaVersion' is distinct from '9'
   or exists (
     select 1
     from jsonb_each(coalesce(payload #> '{data,cubeTracks}', '{}'::jsonb)) as cube_tracks(cube_track_id, cube_track)
     where not (cube_track ? 'affection')
   );

-- Public chapter payloads are denormalized snapshots, so give every existing track
-- the explicit no-selection value before the application publishes future choices.
update public.published_chapters
set payload = jsonb_set(
  payload,
  '{tracks}',
  coalesce(
    (
      select jsonb_agg(
        jsonb_set(track, '{affection}', coalesce(track -> 'affection', 'null'::jsonb), true)
      )
      from jsonb_array_elements(coalesce(payload -> 'tracks', '[]'::jsonb)) as tracks(track)
    ),
    '[]'::jsonb
  ),
  true
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(payload -> 'tracks', '[]'::jsonb)) as tracks(track)
  where not (track ? 'affection')
);
