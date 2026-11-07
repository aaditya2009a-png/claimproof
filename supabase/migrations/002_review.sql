-- ClaimProof migration 002: AI review runs. Run once in the Supabase SQL Editor AFTER 001.
--
-- These two functions are PRIVILEGED (SECURITY DEFINER) and callable ONLY by the server using the
-- service-role/secret key. Browsers cannot call them, so a user can never write their own findings.
-- Each function re-checks who the acting user is (p_actor) and what they may do.

create or replace function public.start_review_run(
  p_actor uuid, p_submission uuid, p_version uuid, p_model text, p_sources jsonb, p_coverage jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  s public.submissions;
  v_role text;
  v_run uuid;
  v_count integer;
begin
  select * into s from public.submissions where id = p_submission for update;
  if not found then raise exception 'claimproof: submission not found'; end if;
  select role into v_role from public.workspace_members
    where workspace_id = s.workspace_id and user_id = p_actor;
  if v_role is null or v_role = 'reviewer' or s.creator_id <> p_actor then
    raise exception 'claimproof: only the creator can run a review';
  end if;
  if s.current_version_id <> p_version then
    raise exception 'claimproof: the draft changed. Reload the page and try again';
  end if;
  if s.status in ('in_review','approved') then
    raise exception 'claimproof: edit the draft to create a new version before running another review';
  end if;
  if exists (select 1 from public.review_runs
             where submission_version_id = p_version and status = 'running'
               and started_at > now() - interval '3 minutes') then
    raise exception 'claimproof: a review is already running for this version';
  end if;
  select count(*) into v_count from public.review_runs where submission_version_id = p_version;
  if v_count >= 8 then
    raise exception 'claimproof: review limit reached for this version. Edit the draft to create a new version';
  end if;

  insert into public.review_runs
    (workspace_id, submission_id, submission_version_id, requested_by, model, source_coverage, sources_snapshot)
    values (s.workspace_id, s.id, p_version, p_actor, left(p_model, 100), p_coverage, p_sources)
    returning id into v_run;
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (s.workspace_id, s.id, p_actor, 'review_started', jsonb_build_object('review_run_id', v_run));
  return v_run;
end $$;

create or replace function public.record_review_result(
  p_actor uuid, p_run uuid, p_status text, p_findings jsonb, p_error_code text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r public.review_runs;
  s public.submissions;
  f jsonb;
  v_n integer := 0;
begin
  select * into r from public.review_runs where id = p_run for update;
  if not found or r.status <> 'running' or r.requested_by <> p_actor then
    raise exception 'claimproof: review run not found';
  end if;
  if p_status not in ('succeeded','failed') then
    raise exception 'claimproof: invalid status';
  end if;
  select * into s from public.submissions where id = r.submission_id for update;

  -- A failed run, or one whose version is no longer current, NEVER changes the submission status.
  if p_status = 'succeeded' and s.current_version_id <> r.submission_version_id then
    p_status := 'failed';
    p_error_code := 'stale_version';
  end if;
  if p_status = 'failed' then
    update public.review_runs
      set status = 'failed', error_code = left(coalesce(p_error_code, 'unknown'), 60), completed_at = now()
      where id = p_run;
    insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
      values (r.workspace_id, r.submission_id, p_actor, 'review_failed',
              jsonb_build_object('review_run_id', p_run, 'error_code', left(coalesce(p_error_code,'unknown'), 60)));
    return;
  end if;

  for f in select value from jsonb_array_elements(p_findings) loop
    insert into public.findings
      (workspace_id, review_run_id, submission_version_id, category, severity, flagged_text, explanation,
       evidence_status, evidence, rule_references, suggested_replacement, suggested_action)
    values
      (r.workspace_id, p_run, r.submission_version_id, f->>'category', f->>'severity', f->>'flagged_text',
       f->>'explanation', f->>'evidence_status', coalesce(f->'evidence','[]'::jsonb),
       coalesce(f->'rule_references','[]'::jsonb), nullif(f->>'suggested_replacement',''),
       nullif(f->>'suggested_action',''));
    v_n := v_n + 1;
  end loop;

  update public.review_runs set status = 'succeeded', completed_at = now() where id = p_run;
  update public.submissions set status = 'analyzed', updated_at = now()
    where id = s.id and status in ('draft','analyzed','changes_requested');
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (r.workspace_id, r.submission_id, p_actor, 'review_completed',
            jsonb_build_object('review_run_id', p_run, 'findings', v_n));
end $$;

revoke all on function public.start_review_run(uuid, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.record_review_result(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.start_review_run(uuid, uuid, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.record_review_result(uuid, uuid, text, jsonb, text) to service_role;
