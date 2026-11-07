-- ClaimProof security checks. Run in the SQL Editor AFTER migrations 001-003 and the demo seed.
-- Everything runs in one transaction that is ROLLED BACK at the end (it ends with an intentional error
-- that lists PASS/FAIL per check). Your real data is not changed.
do $$
declare
  ws uuid; adm uuid; cre uuid; rev uuid; other_ws uuid;
  sub uuid; v1 uuid; v2 uuid; run uuid; fnd uuid; out text := ''; n int; st text;
  procedure_ok boolean;

  -- act as a user for auth.uid()
  -- (set_config is local to this transaction)
begin
  select id into ws from public.workspaces where name = 'PayNest (demo)';
  select user_id into adm from public.workspace_members where workspace_id = ws and role = 'admin';
  select user_id into cre from public.workspace_members where workspace_id = ws and role = 'creator';
  select user_id into rev from public.workspace_members where workspace_id = ws and role = 'reviewer';

  -- fixture: a submission in review with one blocking finding and a succeeded review
  insert into public.submissions (workspace_id, creator_id, title, status) values (ws, cre, 'TEST submission', 'in_review') returning id into sub;
  insert into public.submission_versions (submission_id, workspace_id, version_number, content, content_hash, created_by)
    values (sub, ws, 1, 'Test draft text one.', 'h1', cre) returning id into v1;
  update public.submissions set current_version_id = v1 where id = sub;
  insert into public.review_runs (workspace_id, submission_id, submission_version_id, requested_by, status)
    values (ws, sub, v1, cre, 'succeeded') returning id into run;
  insert into public.findings (workspace_id, review_run_id, submission_version_id, category, severity, flagged_text, explanation, evidence_status)
    values (ws, run, v1, 'unsupported_claim', 'blocking', 'Test draft', 'x', 'no_support_found_in_reviewed_sources') returning id into fnd;

  -- 1. Creator cannot approve
  perform set_config('request.jwt.claim.sub', cre::text, true);
  begin perform public.review_submission(sub, v1, 'approved', 'ok'); out := out || E'FAIL creator can approve\n';
  exception when others then out := out || E'PASS creator cannot approve\n'; end;

  -- 2. Admin who created the submission cannot approve it (reviewer cannot review own work)
  update public.submissions set creator_id = adm where id = sub;
  perform set_config('request.jwt.claim.sub', adm::text, true);
  begin perform public.review_submission(sub, v1, 'approved', 'ok'); out := out || E'FAIL own submission approved\n';
  exception when others then out := out || E'PASS reviewer cannot approve own submission\n'; end;
  update public.submissions set creator_id = cre where id = sub;

  -- 3. Blocker prevents approval; creator cannot clear it; reviewer override then approve works
  perform set_config('request.jwt.claim.sub', rev::text, true);
  begin perform public.review_submission(sub, v1, 'approved', 'ok'); out := out || E'FAIL approved with open blocker\n';
  exception when others then out := out || E'PASS blocker prevents approval\n'; end;
  perform set_config('request.jwt.claim.sub', cre::text, true);
  begin perform public.decide_finding(fnd, 'dismissed', 'just dismiss it'); out := out || E'FAIL creator dismissed blocker\n';
  exception when others then out := out || E'PASS creator cannot dismiss a blocker\n'; end;
  perform public.decide_finding(fnd, 'disputed', 'I disagree with this');
  perform set_config('request.jwt.claim.sub', rev::text, true);
  begin perform public.review_submission(sub, v1, 'approved', 'ok'); out := out || E'FAIL creator dispute cleared blocker\n';
  exception when others then out := out || E'PASS dispute alone does not clear a blocker\n'; end;

  -- 4. Stale version rejected
  insert into public.submission_versions (submission_id, workspace_id, version_number, content, content_hash, created_by)
    values (sub, ws, 2, 'Test draft text two.', 'h2', cre) returning id into v2;
  update public.submissions set current_version_id = v2 where id = sub;
  begin perform public.review_submission(sub, v1, 'approved', 'ok'); out := out || E'FAIL stale version approved\n';
  exception when others then out := out || E'PASS stale-version approval rejected\n'; end;
  update public.submissions set current_version_id = v1 where id = sub;

  -- 5. With an override, a reviewer can approve; then an edit invalidates the approval but keeps history
  perform public.decide_finding(fnd, 'overridden', 'Accepted by reviewer for test');
  perform public.review_submission(sub, v1, 'approved', 'ok');
  select status into st from public.submissions where id = sub;
  out := out || case when st = 'approved' then E'PASS reviewer approval with override works\n' else E'FAIL approval did not apply\n' end;
  perform set_config('request.jwt.claim.sub', cre::text, true);
  perform public.save_new_version(sub, 'TEST submission', 'Test draft text edited after approval.');
  select status into st from public.submissions where id = sub;
  select count(*) into n from public.approvals where submission_id = sub and decision = 'approved';
  out := out || case when st = 'draft' and n = 1 then E'PASS edit invalidates approval, history kept\n' else E'FAIL edit did not reset status\n' end;

  -- 6. A failed/absent review cannot lead to approval
  update public.submissions set status = 'analyzed' where id = sub;
  update public.review_runs set status = 'failed' where id = run;
  begin perform public.request_approval(sub); out := out || E'FAIL approval requested without successful review\n';
  exception when others then out := out || E'PASS no approval request without a successful review\n'; end;

  -- 7. Cross-workspace access denied
  insert into public.workspaces (name) values ('TEST other workspace') returning id into other_ws;
  insert into public.submissions (workspace_id, creator_id, title) values (other_ws, cre, 'TEST foreign') returning id into sub;
  perform set_config('request.jwt.claim.sub', cre::text, true);
  begin perform public.save_new_version(sub, 'TEST foreign', 'Trying to edit another workspace.'); out := out || E'FAIL cross-workspace edit\n';
  exception when others then out := out || E'PASS cross-workspace function access denied\n'; end;
  set local role authenticated;
  select count(*) into n from public.submissions where workspace_id = other_ws;
  reset role;
  out := out || case when n = 0 then E'PASS cross-workspace rows hidden by RLS\n' else E'FAIL cross-workspace rows visible\n' end;

  raise exception E'SECURITY CHECKS (rolled back, no data changed):\n%', out;
end $$;
