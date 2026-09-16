create type public.question_type as enum ('quiz', 'wordcloud', 'open', 'ranking');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  current_question_id uuid,
  created_at timestamptz not null default now()
);

create table public.event_admins (
  event_id uuid primary key references public.events(id) on delete cascade,
  admin_token text unique not null
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type public.question_type not null,
  title text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option integer,
  position integer not null default 0
);

alter table public.events
  add constraint events_current_question_fkey
  foreign key (current_question_id) references public.questions(id) on delete set null;

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_id uuid not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index responses_question_idx on public.responses (question_id);
create index responses_event_idx on public.responses (event_id);
create index questions_event_idx on public.questions (event_id);

-- Grants (column-level on events so admin_token never lives there)
grant select (id, code, title, current_question_id, created_at) on public.events to anon;
grant select on public.questions to anon;
grant select on public.responses to anon;
grant all on public.events to service_role;
grant all on public.event_admins to service_role;
grant all on public.questions to service_role;
grant all on public.responses to service_role;

alter table public.events enable row level security;
alter table public.event_admins enable row level security;
alter table public.questions enable row level security;
alter table public.responses enable row level security;

create policy "Public read events" on public.events for select to anon using (true);
create policy "Public read questions" on public.questions for select to anon using (true);
create policy "Public read responses" on public.responses for select to anon using (true);

-- Realtime
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.responses;