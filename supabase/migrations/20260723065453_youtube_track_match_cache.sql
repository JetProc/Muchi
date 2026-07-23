create table public.youtube_track_match_cache (
  cache_key text primary key,
  algorithm_version text not null,
  candidates jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_track_match_cache_key_format
    check (cache_key ~ '^[a-f0-9]{64}$'),
  constraint youtube_track_match_cache_candidates_array
    check (jsonb_typeof(candidates) = 'array')
);

create index youtube_track_match_cache_expires_at_idx
  on public.youtube_track_match_cache (expires_at);

alter table public.youtube_track_match_cache enable row level security;

revoke all on table public.youtube_track_match_cache from anon, authenticated;
grant select, insert, update, delete on table public.youtube_track_match_cache to service_role;

comment on table public.youtube_track_match_cache is
  'Server-only cache for YouTube track match candidates. The service role bypasses RLS; no user policies are defined.';
