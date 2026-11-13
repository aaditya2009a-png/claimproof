-- 1. Add stale-content tracking columns to submissions
alter table public.submissions
  add column if not exists needs_recheck boolean not null default false,
  add column if not exists recheck_reason text;

-- 2. Auto-flag approved submissions when a cited source changes or expires
create or replace function public.flag_stale_submissions_on_source_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.version > old.version)
     or (new.expiry_date is distinct from old.expiry_date)
     or (new.approved is distinct from old.approved) then
    update public.submissions s
    set
      needs_recheck = true,
      recheck_reason = format(
        'Source "%s" updated (v%s -> v%s) or expiry changed.',
        new.title, old.version, new.version
      )
    where s.workspace_id = new.workspace_id
      and s.status = 'approved'
      and exists (
        select 1
        from public.review_runs rr
        join public.review_findings rf on rf.review_run_id = rr.id
        where rr.submission_id = s.id
          and rr.version_number = s.current_version
          and rf.source_id = new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_flag_stale_submissions on public.approved_sources;
create trigger trg_flag_stale_submissions
after update on public.approved_sources
for each row
execute function public.flag_stale_submissions_on_source_update();
