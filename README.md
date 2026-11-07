# ClaimProof (PayNest demo)

Reviews marketing drafts against approved company facts before publication.
**Batch 1 includes:** login, roles, approved sources (add/edit/list), draft saving with immutable versions, dashboard, database + security rules.
**Batch 2 adds:** real AI review (Gemini) with validated findings and an evidence UI.
**Batch 3 adds:** request approval, reviewer queue, approve / request changes, dispute and override with a reason, comments, Evidence Passport (print / save as PDF), security checks.

## 1. Software you need
- Node.js 20 or newer (LTS) from https://nodejs.org — check with `node -v`
- VS Code from https://code.visualstudio.com
- A free Supabase account: https://supabase.com

## 2. Open the project
Unzip `claimproof.zip` (right-click → Extract All on Windows). In VS Code: File → Open Folder → pick the `claimproof` folder. Open the terminal: Terminal → New Terminal.

## 3. Install
```
npm install
```
This also creates `package-lock.json` (commit it).

## 4. Create the Supabase project
1. Supabase dashboard → New project. Choose a name, a database password (save it), and a region near you.
2. Wait until the project finishes starting.
3. Authentication → sign-in settings: turn **off** "Allow new users to sign up" (so nobody can register themselves). Menu labels shift a little between dashboard versions.

## 5. Run the database SQL
1. Dashboard → SQL Editor → New query.
2. Open `supabase/migrations/001_schema_and_rls.sql` in VS Code, copy everything, paste, click Run. It should say "Success".
Run it only once. To start over, delete the project or drop the tables first.

## 6. Create the test accounts and roles
1. Dashboard → Authentication → Users → Add user → Create new user. Create three, ticking **Auto Confirm User**, with a password of your choice:
   - `admin@paynest.test`
   - `creator@paynest.test`
   - `reviewer@paynest.test`
2. SQL Editor → new query → paste `supabase/seed/demo_seed.sql` → Run. This creates the fictional "PayNest (demo)" workspace, assigns the roles (admin / creator / reviewer), and adds 7 sources and 6 sample drafts.
If Supabase rejects `.test` emails, use other emails and edit the three emails at the top of the seed file.
Roles can only be assigned by SQL like this; the app has no way for users to give themselves a role.

## 7. Environment variables
```
Copy-Item .env.example .env.local      (Windows PowerShell)
cp .env.example .env.local             (Mac/Linux)
```
Open `.env.local`. In Supabase → Project Settings → API (or API Keys) copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL` and the **anon / publishable key** into `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never use the `service_role` / secret key. Never paste keys into chat.

## 8. Start the app
```
npm run dev
```
## 9. Open it
http://localhost:3000 — sign in as `admin@paynest.test`.

## 10. Test the Batch 1 workflow
1. Admin: open **Sources** → you see 7 sources; the 2023 customer count shows **Expired**. Add one, edit one (its version number rises).
2. Sign out, sign in as `creator@paynest.test`: **Sources** is read-only. Open **New submission**, write a draft, **Save draft**. Edit it and save again → version history shows v2; v1 is unchanged.
3. Sign in as `reviewer@paynest.test`: no "New submission" link, and `/submissions/new` shows a permission message. You can open any draft read-only.
4. Dashboard numbers come straight from the database (findings stay empty until Batch 2).

Optional checks: `npm run typecheck` and `npm test`.

## 11. Deploy to Vercel (preview)
Push the folder to GitHub, import it at vercel.com, add the two `NEXT_PUBLIC_SUPABASE_*` variables under Project → Settings → Environment Variables, deploy. Then in Supabase → Authentication → URL configuration, set the Site URL to your Vercel address.

## 12. Common errors
- **"Invalid API key" / sign-in always fails:** `.env.local` values wrong or missing; stop the server (Ctrl+C) and run `npm run dev` again after editing.
- **"Create the three demo users first":** do step 6.1 before 6.2.
- **Signed in but "No workspace access":** the seed did not run, or you signed in with an email that is not one of the three.
- **`permission denied` / empty lists:** migration 001 was not run fully; re-check step 5.
- **`npm` not recognised:** reinstall Node.js and reopen VS Code.

## 13. Security design, limitations, disclosures
- Every protected page and server action re-verifies the session with Supabase Auth. Row Level Security limits each user to their workspace; only admins can write sources; submissions and versions are written only through database functions that check the caller's role. Helper function `workspace_role()` is `SECURITY DEFINER` (it only ever returns the caller's own role) to avoid recursive RLS.
- Submission versions are append-only (database trigger) and carry a SHA-256 hash computed in the database.
- The service-role key is not used anywhere. Full draft text is not logged.
- Sources are edited in place with a version counter; Batch 2 stores a snapshot of sources used by each review so past reviews stay reproducible.
- MVP focuses on text only; no visual or accessibility review. A review record is not a legal certificate.
- Batch 2 will send draft text and approved source text to the configured AI provider; this will be spelled out in the app and here. No claim of zero hallucination, compliance, or zero retention is made.
- AI tooling: this code was written with Claude (Anthropic). Disclose this as your event rules require.
- MVP simplification: no embeddings / pgvector yet; source retrieval will be a replaceable function.

## Batch 2 setup (AI review)
1. **Install the AI package:** `npm install` (it adds `@google/genai`).
2. **Run migration 002:** SQL Editor -> New query -> paste `supabase/migrations/002_review.sql` -> Run. Run it once.
3. **Gemini key (free):** sign in at https://aistudio.google.com with your Google account, create an API key. Do not enable billing. Never paste it in chat.
4. **Supabase secret key:** Project Settings -> API Keys -> copy the **secret** (or legacy `service_role`) key. It is used only on the server to save review results.
5. **Edit `.env.local`** and add (see `.env.example`):
```
SUPABASE_SERVICE_ROLE_KEY=...
AI_PROVIDER=gemini
GEMINI_API_KEY=...
AI_MODEL=gemini-3.8-flash
```
Restart `npm run dev`.
6. **Test it:** sign in as `creator@paynest.test`, open "Customer count announcement", press **Run AI review**. Expect a blocking "contradicted claim" quoting the 12,400 source. Try "Faster payments claim" (unsupported, no replacement offered) and "Launch post with banned words" (terminology).

**What is sent to Google:** the draft text and the text of your approved sources (and expired ones, only to spot outdated claims). Use only fictional or non-confidential text; on free tiers Google may use submitted content to improve its products.
**How findings are protected:** the server rejects any result whose source IDs, versions or quotes do not match the sources actually sent, or whose flagged text is not in the draft. Invalid output is discarded (one re-ask, then an error with a Retry button). A failed or stale review never changes a submission to approved. Blocking categories have a minimum severity the model cannot lower.
**MVP simplification:** sources are sent as plain text within a character budget (`REVIEW_CONTEXT_CHAR_BUDGET`); if they do not fit, a coverage warning is shown. There are no embeddings or pgvector yet. `src/lib/review/sources.ts` is the one function to replace to add them.

**Batch 2 errors:** "not configured" -> a key is missing in `.env.local` (restart after editing). "rate limit" -> wait a minute, or set `AI_MODEL=gemini-3.5-flash-lite`. "model not found" -> pick a current model name from AI Studio. Never log or share your keys.

## Batch 3 setup
1. SQL Editor -> New query -> paste `supabase/migrations/003_approval.sql` -> Run (once).
2. Optional security check: new query -> paste `supabase/tests/security_checks.sql` -> Run. It ends with an intentional error that lists PASS/FAIL lines and rolls everything back. All lines should say PASS.
3. Test the workflow: creator runs AI review, presses **Request reviewer approval**. Sign in as `reviewer@paynest.test`, open **Reviewer queue**, open the draft, **Override** each blocking issue with a reason, then **Approve this version**. Open **View Evidence Passport** and press **Print / Save as PDF**. Then edit the draft as the creator: the status goes back to Draft and needs a new approval.
Rules enforced by the database (not just the buttons): only a reviewer/admin who is not the creator can approve; the version must be current; a successful review must exist; every blocking issue needs a reviewer resolve/override with a reason; a creator dispute never clears a blocker; a failed AI run never approves anything.

## Deploy to Vercel (free)
1. Create a free GitHub account, then a new empty repository (private is fine).
2. In the project folder terminal: `git init`, `git add .`, `git commit -m "ClaimProof"`, then the three `git remote add origin ...` / `git branch -M main` / `git push -u origin main` lines GitHub shows. `.env.local` is ignored by `.gitignore`; check it is not in the repository.
3. vercel.com -> sign in with GitHub -> Add New Project -> import the repo.
4. Before deploying, add Environment Variables (same names as `.env.local`): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, AI_PROVIDER, GEMINI_API_KEY, AI_MODEL.
5. Deploy. Then Supabase -> Authentication -> URL configuration: set the Site URL to your `https://....vercel.app` address.
6. Open the Vercel link, sign in as the demo users, and run through the workflow once. Free Supabase projects pause after inactivity: open the dashboard before judging.
After the event, rotate your Supabase secret key and Gemini key.
