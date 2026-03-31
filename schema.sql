-- Ask Underwriter — Supabase Schema

create table if not exists questions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  product_type text not null,
  description text not null,
  bo_url text,
  hubspot_url text,
  status text default 'pending' check (status in ('pending', 'in_progress', 'answered')),
  priority text default 'normal' check (priority in ('normal', 'high', 'urgent')),
  sales_slack_id text not null,
  sales_name text not null,
  slack_channel_id text not null,
  slack_thread_ts text,
  assigned_to text
);

create table if not exists answers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  question_id uuid references questions(id) on delete cascade not null,
  underwriter_name text not null,
  content text not null,
  sent_to_slack boolean default false
);

create index if not exists questions_status_idx on questions(status);
create index if not exists questions_created_at_idx on questions(created_at desc);
create index if not exists answers_question_id_idx on answers(question_id);

-- Disable RLS (internal tool, service role used)
alter table questions disable row level security;
alter table answers disable row level security;
