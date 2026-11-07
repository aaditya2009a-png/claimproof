-- ClaimProof migration 003: approval workflow. Run once in the SQL Editor AFTER 001 and 002.
--
-- PRIVILEGED functions (SECURITY DEFINER), callable by signed-in users. They never trust the caller:
-- each one reads the user from auth.uid(), re-checks workspace membership and role, locks the submission
-- row (FOR UPDATE) so approval and editing cannot race, and only then writes.

create or replace function public.request_approval(p_submission uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.submissions;
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  select * into s from public.submissions where id = p_submission for update;
  if not found or public.workspace_role(s.workspace_id) is null then
    raise exception 'claimproof: submission not found';
  end if;
  if s.creator_id <> auth.uid() then raise exception 'claimproof: only the creator can request approval'; end if;
  if s.status <> 'analyzed' or not exists (
       select 1 from public.review_runs
       where submission_version_id = s.current_version_id and status = 'succeeded') then
    raise exception 'claimproof: run a successful AI review on the current version first';
  end if;
  update public.submissions set status = 'in_review', updated_at = now() where id = s.id;
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (s.workspace_id, s.id, auth.uid(), 'approval_requested', jsonb_build_object('version_id', s.current_version_id));
end $$;

create or replace function public.decide_finding(p_finding uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  f public.findings;
  s public.submissions;
  v_role text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  select * into f from public.findings where id = p_finding;
  if not found then raise exception 'claimproof: finding not found'; end if;
  select s2.* into s from public.submissions s2
    join public.submission_versions sv on sv.submission_id = s2.id
    where sv.id = f.submission_version_id for update of s2;
  v_role := public.workspace_role(s.workspace_id);
  if v_role is null then raise exception 'claimproof: finding not found'; end if;
  if char_length(v_reason) not between 5 and 1000 then
    raise exception 'claimproof: give a reason of at least 5 characters';
  end if;
  if f.submission_version_id <> s.current_version_id then
    raise exception 'claimproof: this finding belongs to an older version';
  end if;

  if p_decision in ('disputed','dismissed') then
    if s.creator_id <> auth.uid() then raise exception 'claimproof: only the creator can dispute or dismiss'; end if;
    if s.status = 'approved' then raise exception 'claimproof: this version is already approved'; end if;
    if p_decision = 'dismissed' and f.severity = 'blocking' then
      raise exception 'claimproof: a blocking issue cannot be dismissed. Dispute it with a reason or revise the draft';
    end if;
    if p_decision = 'dismissed' and s.status = 'in_review' then
      raise exception 'claimproof: the submission is locked while a reviewer decides';
    end if;
  elsif p_decision in ('resolved','overridden') then
    if v_role not in ('reviewer','admin') or s.creator_id = auth.uid() then
      raise exception 'claimproof: only an authorised reviewer who is not the creator can do that';
    end if;
    if s.status <> 'in_review' then raise exception 'claimproof: the submission is not awaiting review'; end if;
  else
    raise exception 'claimproof: invalid decision';
  end if;

  insert into public.finding_decisions (workspace_id, finding_id, decided_by, decision, reason)
    values (s.workspace_id, p_finding, auth.uid(), p_decision, v_reason);
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (s.workspace_id, s.id, auth.uid(), 'finding_' || p_decision, jsonb_build_object('finding_id', p_finding));
end $$;

create or replace function public.add_comment(p_submission uuid, p_finding uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.submissions; v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  select * into s from public.submissions where id = p_submission;
  if not found or public.workspace_role(s.workspace_id) is null then
    raise exception 'claimproof: submission not found';
  end if;
  if char_length(v_body) not between 1 and 2000 then raise exception 'claimproof: comment must be 1 to 2000 characters'; end if;
  if p_finding is not null and not exists (
       select 1 from public.findings f where f.id = p_finding and f.submission_version_id = s.current_version_id) then
    raise exception 'claimproof: finding not found on the current version';
  end if;
  insert into public.comments (workspace_id, submission_id, submission_version_id, finding_id, author_id, body)
    values (s.workspace_id, s.id, s.current_version_id, p_finding, auth.uid(), v_body);
end $$;

-- Approve or request changes. This is the ONLY way a submission becomes 'approved'.
create or replace function public.review_submission(p_submission uuid, p_version uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.submissions;
  v_role text;
  v_run uuid;
  v_blockers integer;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then raise exception 'claimproof: not signed in'; end if;
  if p_decision not in ('approved','changes_requested') then raise exception 'claimproof: invalid decision'; end if;
  select * into s from public.submissions where id = p_submission for update;   -- serialises with edits
  if not found then raise exception 'claimproof: submission not found'; end if;
  v_role := public.workspace_role(s.workspace_id);
  if v_role is null then raise exception 'claimproof: submission not found'; end if;
  if v_role not in ('reviewer','admin') then raise exception 'claimproof: only a reviewer can approve or request changes'; end if;
  if s.creator_id = auth.uid() then raise exception 'claimproof: a reviewer cannot review their own submission'; end if;
  if s.status <> 'in_review' then raise exception 'claimproof: this submission is not awaiting review'; end if;
  if s.current_version_id <> p_version then
    raise exception 'claimproof: this version is no longer current. Reload and review the latest version';
  end if;

  select id into v_run from public.review_runs
    where submission_version_id = p_version and status = 'succeeded' order by started_at desc limit 1;
  if v_run is null then raise exception 'claimproof: no successful AI review exists for this version'; end if;

  if p_decision = 'approved' then
    select count(*) into v_blockers from public.findings f
      where f.review_run_id = v_run and f.severity = 'blocking'
        and not exists (select 1 from public.finding_decisions d
                        where d.finding_id = f.id and d.decision in ('resolved','overridden'));
    if v_blockers > 0 then
      raise exception 'claimproof: % blocking issue(s) must be resolved or overridden with a reason first', v_blockers;
    end if;
  elsif char_length(v_note) < 5 then
    raise exception 'claimproof: explain what needs to change (at least 5 characters)';
  end if;

  insert into public.approvals (workspace_id, submission_id, submission_version_id, reviewer_id, decision, note)
    values (s.workspace_id, s.id, p_version, auth.uid(), p_decision, nullif(v_note, ''));
  update public.submissions set status = p_decision, updated_at = now() where id = s.id;
  insert into public.activity_events (workspace_id, submission_id, actor_id, event_type, metadata)
    values (s.workspace_id, s.id, auth.uid(), 'review_' || p_decision, jsonb_build_object('version_id', p_version));
end $$;

revoke all on function public.request_approval(uuid) from public, anon;
revoke all on function public.decide_finding(uuid, text, text) from public, anon;
revoke all on function public.add_comment(uuid, uuid, text) from public, anon;
revoke all on function public.review_submission(uuid, uuid, text, text) from public, anon;
grant execute on function public.request_approval(uuid) to authenticated;
grant execute on function public.decide_finding(uuid, text, text) to authenticated;
grant execute on function public.add_comment(uuid, uuid, text) to authenticated;
grant execute on function public.review_submission(uuid, uuid, text, text) to authenticated;
