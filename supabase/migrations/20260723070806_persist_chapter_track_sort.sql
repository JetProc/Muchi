-- Persist each chapter's selected track ordering and make affection the default.
-- Incrementing revision forces stale v10 clients to reload before their next save.
update public.user_archives
set
  payload = jsonb_set(
    jsonb_set(payload, '{schemaVersion}', '11'::jsonb, true),
    '{data,cubes}',
    coalesce(
      (
        select jsonb_object_agg(
          cube_id,
          jsonb_set(
            cube,
            '{trackSort}',
            case cube ->> 'trackSort'
              when 'added' then '"added"'::jsonb
              else '"affection"'::jsonb
            end,
            true
          )
        )
        from jsonb_each(coalesce(payload #> '{data,cubes}', '{}'::jsonb))
          as cubes(cube_id, cube)
      ),
      '{}'::jsonb
    ),
    true
  ),
  schema_version = 11,
  revision = revision + 1
where schema_version < 11
   or payload ->> 'schemaVersion' is distinct from '11'
   or exists (
     select 1
     from jsonb_each(coalesce(payload #> '{data,cubes}', '{}'::jsonb)) as cubes(cube_id, cube)
     where not (cube ? 'trackSort')
   );

-- Published chapters are denormalized snapshots. Existing rows adopt the new
-- affection-first default until their owner publishes another saved preference.
update public.published_chapters
set payload = jsonb_set(
  jsonb_set(payload, '{trackSort}', '"affection"'::jsonb, true),
  '{tracks}',
  coalesce(
    (
      select jsonb_agg(track order by
        case track ->> 'affection'
          when 'red' then 0
          when 'orange' then 1
          when 'yellow' then 2
          else 3
        end,
        track_ordinality
      )
      from jsonb_array_elements(coalesce(payload -> 'tracks', '[]'::jsonb))
        with ordinality as tracks(track, track_ordinality)
    ),
    '[]'::jsonb
  ),
  true
)
where not (payload ? 'trackSort');
