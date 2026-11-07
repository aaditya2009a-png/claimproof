-- ClaimProof migration 001: tables, RLS, helper functions, submission functions.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to read top to bottom.

-- ============ TABLES ============
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','creator','reviewer')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

create table public.approved_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  content text not null check (char_length(content) between 10 and 5000),
  type text not null check (type in ('fact','terminology','tone','disclosure')),
  version integer not null default 1,
  approved boolean not null default false,
  effective_date date not null default current_date,
  expiry_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= effective_date)
);
create index on public.approved_sources (workspace_id, approved);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 3 and 200),
  status text not null default 'draft'
    check (status in ('draft','analyzed','in_review','changes_requested','approved')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.submissions (workspace_id, status);
create index on public.submissions (creator_id);

create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  content text not null check (char_length(content) between 1 and 20000),
  content_hash text not null,           -- SHA-256 hex of the UTF-8 content, computed in the database
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);
create index on public.submission_versions (workspace_id);

alter table public.submissions
  add constraint submissions_current_version_fk
  foreign key (current_version_id) references public.submission_versions(id);

create table public.review_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submission_version_id uuid not null references public.submission_versions(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  model text,
  source_coverage jsonb not null default '{}'::jsonb,   -- which sources were sent / truncated
  sources_snapshot jsonb not null default '[]'::jsonb,  -- id, version, text of sources reviewed against
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.review_runs (workspace_id);
create index on public.review_runs (submission_version_id);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_run_id uuid not null references public.review_runs(id) on delete cascade,
  submission_version_id uuid not null references public.submission_versions(id) on delete cascade,
  category text not null check (category in
    ('unsupported_claim','contradicted_claim','outdated_information','terminology','tone','missing_disclosure')),
  severity text not null check (severity in ('blocking','warning','info')),
  flagged_text text not null,
  explanation text not null,
  evidence_status text not null check (evidence_status in
    ('supported','contradicted','outdated','no_support_found_in_reviewed_sources','rule_applies','rule_not_met')),
  evidence jsonb not null default '[]'::jsonb,          -- [{source_id, source_version, quote}]
  rule_references jsonb not null default '[]'::jsonb,
  suggested_replacement text,
  suggested_action text,
  created_at timestamptz not null default now()
);
create index on public.findings (workspace_id, category);
create index on public.findings (review_run_id);
create index on public.findings (submission_version_id);

create table public.finding_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  decided_by uuid not null references auth.users(id),
  decision text not null check (decision in ('disputed','dismissed','resolved','overridden')),
  reason text not null check (char_length(btrim(reason)) >= 5),
  created_at timestamptz not null default now()
);
create index on public.finding_decisions (finding_id);
create index on public.finding_decisions (workspace_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submission_version_id uuid references public.submission_versions(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.comments (submission_id);
create index on public.comments (workspace_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submission_version_id uuid not null references public.submission_versions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','changes_requested')),
  note text,
  created_at timestamptz not null default now()
);
create index on public.approvals (submission_id);
create index on public.approvals (workspace_id, decision);
create unique index approvals_one_approval_per_version
  on public.approvals (submission_version_id) where decision = 'approved';

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_events (workspace_id, created_at desc);
create index on public.activity_events (submission_id);

-- ============ HELPER FUNCTION (avoids recursive RLS) ============
-- SECURITY DEFINER: reads workspace_members without triggering its RLS policy.
-- It can only ever return the CALLING user's own role (it filters on auth.uid()).
create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;
revoke all on function public.workspace_role(uuid) from public, anon;
grant execute on function public.workspace_role(uuid) to authenticated;

-- ============ ROW LEVEL SECURITY ============
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.approved_sources enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.review_runs enable row level security;
alter table public.findings enable row level security;
alter table public.finding_decisions enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;
alter table public.activity_events enable row level security;

create policy workspaces_select on public.workspaces
  for select to authenticated using (public.workspace_role(id) is not null);

do $$
declare t text;
begin
  foreach t in array array['workspace_members','approved_sources','submissions','submission_versions',
    'review_runs','findings','finding_decisions','comments','approvals','activity_events']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.workspace_role(workspace_id) is not null)',
      t || '_select', t);
  end loop;
end $$;

-- Only workspace admins may add or edit approved sources.
create policy approved_sources_insert on public.approved_sources
  for insert to authenticated
  with check (public.workspace_role(workspace_id) = 'admin' and created_by = auth.uid());
create policy approved_sources_update on public.approved_sources
  for update to authenticated
  using (public.workspace_role(workspace_id) = 'admin')
  with check (public.workspace_role(workspace_id) = 'admin');

-- Defence in depth: browsers/clients can only write approved_sources directly.
-- Every other write goes through the SECURITY DEFINER functions below (or in later migrations).
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant insert, update on public.approved_sources to authenticated;

-- ============ TRIGGERS ============
create or replace function public.approved_sources_before_update()
returns trigger language plpgsql as $$
begin
  new.workspace_id := old.workspace_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.version := old.version;
  if new.title is distinct from old.title
     or new.content is distinct from old.content
     or new.type is distinct from old.type
     or new.effective_date is distinct from old.effective_date
     or new.expiry_date is distinct from old.expiry_date then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger approved_sources_bu before update on public.approved_sources
  for each row execute function public.approved_sources_before_update();

-- Append-only tables: updates are rejected.
create or replace function public.forbid_update()
returns trigger language plpgsql as $$
begin
  raise exception 'claimproof: % rows are append-only', tg_table_name;
end $$;
create trigger submission_versions_no_update before update on public.submission_versions
  for each row execute function public.forbid_update();
create trigger findings_no_update before update on public.findings
  for each row execute function public.forbid_update();
create trigger finding_decisions_no_update before update on public.finding_decisions
  for each row execute function public.forbid_update();
create trigger comments_no_update before update on public.comments
  for each row execute function public.forbid_update();
create trigger approvals_no_update before update on public.approvals
  for each row execute function public.forbid_update();
create trigger activity_events_no_update before update on public.activity_events
  for each row execute function public.forbid_update();

-- ============ SUBMISSION FUNCTIONS (authorisation enforced inside) ============
-- SECURITY DEFINER so they can write tables clients cannot write directly.
-- Each one checks auth.uid(), workspace membership and role before doing anything.
create or replace function public.create_submission(p_workspace uuid, p_title text, p_content text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
  v_title text := btrim(p_title);
  v_sub uuid;
  v_ver uuid;
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  v_role := public.workspace_role(p_workspace);
  if v_role is null or v_role = 'reviewer' then
    raise exception 'claimproof: only creators and admins can create submissions';
  end if;
  if char_length(v_title) not between 3 and 200 then
    raise exception 'claimproof: title must be 3 to 200 characters';
  end if;
  if char_length(coalesce(p_content,'')) not between 1 and 20000 then
    raise exception 'claimproof: content must be 1 to 20000 characters';
  end if;

  insert into public.submissions (workspace_id, creator_id, title)
    values (p_workspace, auth.uid(), v_title) returning id into v_sub;
  insert into public.submission_versions
    (submission_id, workspace_id, version_number, content, content_hash, created_by)
    values (v_sub, p_workspace, 1, p_content,
            encode(sha256(convert_to(p_content, 'UTF8')), 'hex'), auth.uid())
    returning id into v_ver;
  update public.submissions set current_version_id = v_ver where id = v_sub;
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (p_workspace, v_sub, auth.uid(), 'submission_created', jsonb_build_object('version_number', 1));
  return v_sub;
end $$;

-- Saves the creator's edit. Changed text => new immutable version, status back to 'draft'
-- (so any earlier approval no longer applies to the current version). Unchanged text => no new version.
create or replace function public.save_new_version(p_submission uuid, p_title text, p_content text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  s public.submissions;
  v_title text := btrim(p_title);
  v_hash text;
  v_cur_hash text;
  v_num integer;
  v_ver uuid;
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  select * into s from public.submissions where id = p_submission for update;  -- row lock
  if not found or public.workspace_role(s.workspace_id) is null then
    raise exception 'claimproof: submission not found';
  end if;
  if s.creator_id <> auth.uid() then
    raise exception 'claimproof: only the creator can edit this submission';
  end if;
  if char_length(v_title) not between 3 and 200 then
    raise exception 'claimproof: title must be 3 to 200 characters';
  end if;
  if char_length(coalesce(p_content,'')) not between 1 and 20000 then
    raise exception 'claimproof: content must be 1 to 20000 characters';
  end if;

  v_hash := encode(sha256(convert_to(p_content, 'UTF8')), 'hex');
  select content_hash, version_number into v_cur_hash, v_num
    from public.submission_versions where id = s.current_version_id;

  update public.submissions set title = v_title, updated_at = now() where id = s.id;
  if v_hash = v_cur_hash then return s.current_version_id; end if;

  insert into public.submission_versions
    (submission_id, workspace_id, version_number, content, content_hash, created_by)
    values (s.id, s.workspace_id, v_num + 1, p_content, v_hash, auth.uid())
    returning id into v_ver;
  update public.submissions
    set current_version_id = v_ver, status = 'draft', updated_at = now() where id = s.id;
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (s.workspace_id, s.id, auth.uid(), 'version_created', jsonb_build_object('version_number', v_num + 1));
  return v_ver;
end $$;

revoke all on function public.create_submission(uuid, text, text) from public, anon;
revoke all on function public.save_new_version(uuid, text, text) from public, anon;
grant execute on function public.create_submission(uuid, text, text) to authenticated;
grant execute on function public.save_new_version(uuid, text, text) to authenticated;
