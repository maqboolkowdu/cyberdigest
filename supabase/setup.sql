-- CyberDigest — Supabase setup: usage events + private insight reports.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run: every statement is idempotent.
--
-- Security model
--   * Visitors (the public "anon" key) and signed-in readers can only INSERT events.
--     There are no SELECT, UPDATE or DELETE grants, so nobody can read other people's data through the API.
--   * user_id and created_at are filled in by the database, never by the browser, so they can't be spoofed.
--   * Event names are allow-listed, payloads are size-limited, and each browser is rate-limited.
--   * Reports live in the "insights" schema, which is NOT exposed by the Data API.
--     You read them in the dashboard (SQL Editor or Table Editor), where you are the database owner.

-- ---------------------------------------------------------------- events table
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  anon_id     uuid not null,                       -- random id per browser (no personal data)
  session_id  uuid not null,                       -- random id per visit/tab
  user_id     uuid references auth.users (id) on delete set null,  -- set by trigger when signed in
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  route       text,
  app_version text,
  constraint events_event_allowed check (event in (
    'welcome_step', 'welcome_done', 'welcome_skip',
    'otp_requested', 'otp_failed', 'signed_in', 'signed_out',
    'page_view', 'byte_read', 'byte_saved', 'story_opened',
    'explore_filter', 'search', 'design_changed', 'theme_changed',
    'goal_reached', 'export'
  )),
  constraint events_props_object check (jsonb_typeof(props) = 'object'),
  constraint events_props_small check (octet_length(props::text) <= 2048),
  constraint events_route_short check (route is null or char_length(route) <= 40),
  constraint events_version_short check (app_version is null or char_length(app_version) <= 20)
);

create index if not exists events_anon_time_idx on public.events (anon_id, created_at);
create index if not exists events_event_time_idx on public.events (event, created_at);
create index if not exists events_user_idx on public.events (user_id) where user_id is not null;

-- ---------------------------------------------------------------- trigger: trusted fields + rate limit
create or replace function public.events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Never trust the browser for these.
  new.created_at := now();
  new.user_id := auth.uid();   -- null for guests, the signed-in user's id otherwise

  -- At most 120 events per browser per minute (normal use is a handful).
  if (select count(*) from public.events e
      where e.anon_id = new.anon_id and e.created_at > now() - interval '1 minute') >= 120 then
    raise exception 'rate limit exceeded' using errcode = '53400';
  end if;
  return new;
end;
$$;

revoke all on function public.events_before_insert() from public, anon, authenticated;

drop trigger if exists events_before_insert on public.events;
create trigger events_before_insert
  before insert on public.events
  for each row execute function public.events_before_insert();

-- ---------------------------------------------------------------- privileges + row level security
alter table public.events enable row level security;

revoke all on table public.events from anon, authenticated;
grant insert (anon_id, session_id, event, props, route, app_version) on table public.events to anon, authenticated;

drop policy if exists "visitors can add events" on public.events;
create policy "visitors can add events"
  on public.events for insert
  to anon, authenticated
  with check (true);   -- the trigger and constraints above do the checking
-- No SELECT / UPDATE / DELETE policies on purpose.

-- ---------------------------------------------------------------- private reports (not exposed by the API)
create schema if not exists insights;
revoke all on schema insights from public, anon, authenticated;

-- Where visitors drop out of the welcome tour.
create or replace view insights.welcome_funnel as
with steps as (
  select (props->>'step')::int as step, props->>'name' as name, anon_id
  from public.events where event = 'welcome_step'
)
select step, max(name) as step_name, count(distinct anon_id) as visitors
from steps group by step
union all
select 99, 'finished tour', count(distinct anon_id) from public.events where event = 'welcome_done'
order by 1;

-- Daily activity.
create or replace view insights.daily_activity as
select date_trunc('day', created_at)::date as day,
       count(distinct anon_id)                                  as visitors,
       count(distinct user_id)                                  as signed_in_readers,
       count(*) filter (where event = 'byte_read')              as bytes_read,
       count(*) filter (where event = 'byte_saved')             as bytes_saved,
       count(*) filter (where event = 'story_opened')           as stories_opened,
       count(*) filter (where event = 'goal_reached')           as goals_reached
from public.events
group by 1 order by 1 desc;

-- Which features get used (last 30 days).
create or replace view insights.feature_usage_30d as
select event, count(*) as times, count(distinct anon_id) as visitors
from public.events
where created_at > now() - interval '30 days'
group by event order by times desc;

-- Topics people actually read (last 30 days).
create or replace view insights.topics_read_30d as
select coalesce(props->>'topic', 'unknown') as topic,
       count(*) as bytes_read,
       count(*) filter (where (props->>'gcc')::boolean) as gcc_bytes
from public.events
where event = 'byte_read' and created_at > now() - interval '30 days'
group by 1 order by 2 desc;

-- Design and theme choices made in the tour.
create or replace view insights.design_choices as
select props->>'skin' as design, props->>'theme' as theme, count(distinct anon_id) as visitors
from public.events where event = 'welcome_done'
group by 1, 2 order by 3 desc;

-- Sign-in conversion per day.
create or replace view insights.signin_daily as
select date_trunc('day', created_at)::date as day,
       count(*) filter (where event = 'otp_requested') as codes_sent,
       count(*) filter (where event = 'signed_in')     as sign_ins,
       count(*) filter (where event = 'otp_failed')    as failed_codes
from public.events
group by 1 order by 1 desc;

-- Signed-in readers (owner only: includes email addresses).
create or replace view insights.readers as
select u.email,
       min(e.created_at) as first_seen,
       max(e.created_at) as last_seen,
       count(*) filter (where e.event = 'byte_read')  as bytes_read,
       count(*) filter (where e.event = 'byte_saved') as bytes_saved
from public.events e
join auth.users u on u.id = e.user_id
group by u.email order by last_seen desc;

revoke all on all tables in schema insights from public, anon, authenticated;

-- Optional housekeeping: keep 13 months of events. Run by hand, or schedule with pg_cron.
-- delete from public.events where created_at < now() - interval '13 months';
