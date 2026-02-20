-- Core schema for Prompit MVP
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) > 0 and char_length(title) <= 120),
  category text not null check (char_length(category) > 0 and char_length(category) <= 40),
  content text not null check (char_length(content) > 0 and char_length(content) <= 4000),
  tags text[] not null default '{}',
  author_id uuid not null references auth.users (id) on delete cascade,
  forked_from uuid null references public.prompts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_votes (
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

create table if not exists public.prompt_copies (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompts_created_at on public.prompts (created_at desc);
create index if not exists idx_prompts_author_id on public.prompts (author_id);
create index if not exists idx_prompt_copies_prompt_id on public.prompt_copies (prompt_id);
create index if not exists idx_prompt_votes_prompt_id on public.prompt_votes (prompt_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prompts_updated_at on public.prompts;
create trigger trg_prompts_updated_at
before update on public.prompts
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_prompit on auth.users;
create trigger on_auth_user_created_prompit
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.is_allowed_company_user()
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  with settings as (
    select coalesce(nullif(current_setting('app.settings.company_domain', true), ''), 'yourcompany.com') as domain
  )
  select exists (
    select 1
    from auth.users u
    cross join settings s
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) like ('%@' || lower(s.domain))
  );
$$;

create or replace view public.prompts_with_stats as
select
  p.id,
  p.title,
  p.category,
  p.content,
  p.tags,
  p.author_id,
  pr.full_name as author_name,
  p.forked_from,
  p.created_at,
  p.updated_at,
  coalesce(v.vote_count, 0)::int as upvote_count,
  coalesce(c.copy_count, 0)::int as copy_count
from public.prompts p
left join public.profiles pr on pr.id = p.author_id
left join (
  select prompt_id, count(*) as vote_count
  from public.prompt_votes
  group by prompt_id
) v on v.prompt_id = p.id
left join (
  select prompt_id, count(*) as copy_count
  from public.prompt_copies
  group by prompt_id
) c on c.prompt_id = p.id;

alter table public.profiles enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_votes enable row level security;
alter table public.prompt_copies enable row level security;

-- Profiles
create policy "Profiles read for allowed users"
on public.profiles
for select
using (public.is_allowed_company_user());

create policy "Profiles insert self"
on public.profiles
for insert
with check (auth.uid() = id and public.is_allowed_company_user());

create policy "Profiles update self"
on public.profiles
for update
using (auth.uid() = id and public.is_allowed_company_user())
with check (auth.uid() = id and public.is_allowed_company_user());

-- Prompts
create policy "Prompts read for allowed users"
on public.prompts
for select
using (public.is_allowed_company_user());

create policy "Prompts insert for allowed users"
on public.prompts
for insert
with check (public.is_allowed_company_user() and auth.uid() = author_id);

create policy "Prompts update owner only"
on public.prompts
for update
using (public.is_allowed_company_user() and auth.uid() = author_id)
with check (public.is_allowed_company_user() and auth.uid() = author_id);

create policy "Prompts delete owner only"
on public.prompts
for delete
using (public.is_allowed_company_user() and auth.uid() = author_id);

-- Votes
create policy "Votes read for allowed users"
on public.prompt_votes
for select
using (public.is_allowed_company_user());

create policy "Votes insert once per user"
on public.prompt_votes
for insert
with check (public.is_allowed_company_user() and auth.uid() = user_id);

-- Copies
create policy "Copies read for allowed users"
on public.prompt_copies
for select
using (public.is_allowed_company_user());

create policy "Copies insert for allowed users"
on public.prompt_copies
for insert
with check (public.is_allowed_company_user() and auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.prompts_with_stats to anon, authenticated;
grant select, insert, update, delete on public.prompts to authenticated;
grant select, insert on public.prompt_votes to authenticated;
grant select, insert on public.prompt_copies to authenticated;
grant select, insert, update on public.profiles to authenticated;
