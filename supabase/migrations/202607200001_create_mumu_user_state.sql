create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_archives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  schema_version integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discovery_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{"followedProfileIds":[],"likedChapterIds":[],"readActivityIds":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 80), left(new.raw_user_meta_data ->> 'name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger archives_set_updated_at before update on public.user_archives for each row execute procedure public.set_updated_at();
create trigger discovery_states_set_updated_at before update on public.discovery_states for each row execute procedure public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_archives enable row level security;
alter table public.discovery_states enable row level security;

create policy "profiles are private to their owner" on public.profiles for all to authenticated using (auth.uid() is not null and auth.uid() = id) with check (auth.uid() is not null and auth.uid() = id);
create policy "archives are private to their owner" on public.user_archives for all to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy "discovery state is private to its owner" on public.discovery_states for all to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
