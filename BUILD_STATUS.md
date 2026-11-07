# BUILD_STATUS

Batch 1 (foundation): done, running. Batch 2 (AI review): done, running (user confirmed a review completed).
Batch 3 (approval, queue, comments, Evidence Passport, security checks): files WRITTEN, not yet run.
Verified here: TypeScript syntax only. NOT verified: migration 003, security_checks.sql, the new pages.

To apply: copy project files over (Replace), run supabase/migrations/003_approval.sql, optionally supabase/tests/security_checks.sql, restart npm run dev.
Next: test the workflow end to end, deploy to Vercel (see README), rotate keys after the event.
Known limits: text only; sources edited in place (review snapshots keep what was reviewed); dashboard findings count includes findings of repeated reviews; no embeddings (source retrieval is one replaceable function).
