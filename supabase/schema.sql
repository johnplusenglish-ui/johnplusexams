-- johnplusexams database. Run once in the Supabase SQL editor of the NEW project.
-- Who can read what is decided here, not in the website: the anon key in config.js is public.

-- Packs a person has paid for. Written only by the Lemon Squeezy webhook (service role).
create table if not exists entitlements (
  id bigint generated always as identity primary key,
  email text not null,
  product text not null,              -- 'c1-student' or 'c1-teacher'
  expires_at timestamptz not null,
  order_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists entitlements_email on entitlements (lower(email));

-- The list of papers in each pack (no questions here, safe to show to signed-in users).
create table if not exists paper_index (
  id text primary key,                -- 'c1-01'
  pack text not null,                 -- 'c1'
  title text not null,
  topics text,
  sort int not null default 0,
  pdf_student text,                   -- path in the private 'pdfs' bucket
  pdf_teacher text
);

-- The papers themselves (the paid content).
create table if not exists papers (
  id text primary key references paper_index(id) on delete cascade,
  pack text not null,
  data jsonb not null
);

-- Every part a student checks.
create table if not exists attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  part text not null,
  score int not null,
  max int not null,
  created_at timestamptz not null default now()
);
create index if not exists attempts_user on attempts (user_id);

-- Every question a student got wrong, until they get it right.
create table if not exists mistakes (
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  part text not null,
  q int not null,
  given text,
  resolved boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id, q)
);

-- Does the signed-in person have an active pack whose product belongs to this pack?
create or replace function has_pack(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements e
    where lower(e.email) = lower(auth.jwt() ->> 'email')
      and e.expires_at > now()
      and split_part(e.product, '-', 1) = p
  );
$$;
create or replace function has_teacher(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entitlements e
    where lower(e.email) = lower(auth.jwt() ->> 'email')
      and e.expires_at > now()
      and e.product = p || '-teacher'
  );
$$;

alter table entitlements enable row level security;
alter table paper_index enable row level security;
alter table papers enable row level security;
alter table attempts enable row level security;
alter table mistakes enable row level security;

drop policy if exists "own entitlements" on entitlements;
create policy "own entitlements" on entitlements for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "index for buyers" on paper_index;
create policy "index for buyers" on paper_index for select to authenticated using (has_pack(pack));

drop policy if exists "papers for buyers" on papers;
create policy "papers for buyers" on papers for select to authenticated using (has_pack(pack));

drop policy if exists "own attempts read" on attempts;
create policy "own attempts read" on attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists "own attempts write" on attempts;
create policy "own attempts write" on attempts for insert to authenticated with check (user_id = auth.uid() and has_pack(split_part(paper_id, '-', 1)));

drop policy if exists "own mistakes" on mistakes;
create policy "own mistakes" on mistakes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and has_pack(split_part(paper_id, '-', 1)));

-- Private bucket for the PDFs. Folder = pack ('c1/c1-01-student.pdf'). Teacher PDFs need the teacher licence.
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false) on conflict (id) do nothing;
drop policy if exists "pdfs for buyers" on storage.objects;
create policy "pdfs for buyers" on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs'
    and has_pack((storage.foldername(name))[1])
    and (name not like '%-teacher.pdf' or has_teacher((storage.foldername(name))[1]))
  );
