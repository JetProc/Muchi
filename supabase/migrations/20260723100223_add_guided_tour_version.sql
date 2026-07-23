alter table public.profiles
add column if not exists guided_tour_version integer not null default 0
check (guided_tour_version >= 0);

-- Existing users keep their current experience. Profiles created after this
-- migration retain the default zero and receive the tour after onboarding.
update public.profiles
set guided_tour_version = 1
where guided_tour_version = 0;
