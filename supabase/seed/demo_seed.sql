-- ClaimProof demo seed (fictional company "PayNest"). Run AFTER migration 001 and AFTER creating the
-- three demo users in Authentication -> Users. Edit the three emails below if you used different ones.
do $$
declare
  admin_email    text := 'admin@paynest.test';
  creator_email  text := 'creator@paynest.test';
  reviewer_email text := 'reviewer@paynest.test';
  a uuid; c uuid; r uuid; ws uuid; sid uuid; vid uuid; d record;
begin
  select id into a from auth.users where lower(email) = lower(admin_email);
  select id into c from auth.users where lower(email) = lower(creator_email);
  select id into r from auth.users where lower(email) = lower(reviewer_email);
  if a is null or c is null or r is null then
    raise exception 'Create the three demo users first (README step 6), or fix the emails at the top of this file.';
  end if;
  if exists (select 1 from public.workspaces where name = 'PayNest (demo)') then
    raise exception 'Demo workspace already exists. Nothing was changed.';
  end if;

  insert into public.workspaces (name) values ('PayNest (demo)') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role, display_name) values
    (ws, a, 'admin', 'Demo Admin'),
    (ws, c, 'creator', 'Demo Creator'),
    (ws, r, 'reviewer', 'Demo Reviewer');

  -- All text below is fictional.
  insert into public.approved_sources (workspace_id, title, content, type, approved, effective_date, expiry_date, created_by) values
  (ws, 'Current customer count',
   'As of 1 October 2026, PayNest serves 12,400 active small-business customers.',
   'fact', true, '2026-10-01', null, a),
  (ws, 'Historical customer count (expired)',
   'In January 2023, PayNest served 5,000 small-business customers.',
   'fact', true, '2023-01-01', '2024-01-01', a),
  (ws, 'Product capabilities',
   'PayNest supports invoicing, recurring payment reminders, bank-transfer reconciliation, and optional pay-later for eligible customers. PayNest does not currently offer payroll or international payments.',
   'fact', true, '2026-01-01', null, a),
  (ws, 'Preferred terminology',
   'Say "customer" (not "client" or "user"). Say "payment link" (not "pay-link" or "payment URL"). Never use the words "revolutionary", "game-changing", or "foolproof".',
   'terminology', true, '2026-01-01', null, a),
  (ws, 'Brand tone',
   'Write in a factual, plain, friendly voice. Avoid hype, exclamation marks, and unsourced superlatives such as "best" or "fastest".',
   'tone', true, '2026-01-01', null, a),
  (ws, 'No unsupported absolute guarantees',
   'Do not use absolute guarantees (for example "guarantee", "always", "never fails", "100%", "risk-free") unless an approved fact explicitly supports the exact promise.',
   'tone', true, '2026-01-01', null, a),
  (ws, 'Pay-later disclosure',
   'Any content that mentions PayNest pay-later options must include the sentence: "Pay-later options are subject to eligibility and approval." Content that does not mention pay-later does not need this sentence.',
   'disclosure', true, '2026-01-01', null, a);

  for d in
    select * from (values
      ('Supported feature overview', 'PayNest helps small businesses send invoices, schedule recurring payment reminders, and reconcile bank transfers in one place.'),
      ('Customer count announcement', 'Join the 25,000 small businesses already using PayNest.'),
      ('Faster payments claim', 'Customers get paid up to 3x faster with PayNest reminders.'),
      ('Reliability promise', 'PayNest never fails and keeps your cash flow 100% risk-free.'),
      ('Launch post with banned words', 'PayNest is a revolutionary way to send payment links to your clients!'),
      ('Clean payment link post', 'PayNest lets customers pay invoices through a payment link and automatically reconciles matching bank transfers. Pay-later options are subject to eligibility and approval.')
    ) as t(title, content)
  loop
    insert into public.submissions (workspace_id, creator_id, title) values (ws, c, d.title) returning id into sid;
    insert into public.submission_versions (submission_id, workspace_id, version_number, content, content_hash, created_by)
      values (sid, ws, 1, d.content, encode(sha256(convert_to(d.content, 'UTF8')), 'hex'), c) returning id into vid;
    update public.submissions set current_version_id = vid where id = sid;
  end loop;
end $$;
