"use client";
import { ActionForm } from "@/components/action-form";
import { FormMessage } from "@/components/form-message";
import { signIn } from "./actions";

const POINTS = [
  "Check marketing drafts against approved company facts",
  "See the exact source quote behind every issue",
  "A different reviewer approves the final version",
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-center bg-navy-900 px-8 py-12 text-white md:px-14">
        <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-600 text-lg" aria-hidden="true">✓</span>
          <span>Claim<span className="text-teal-500">Proof</span></span>
        </div>
        <h1 className="mt-8 text-3xl font-semibold leading-tight md:text-4xl">Review claims before they go live.</h1>
        <ul className="mt-6 space-y-3 text-navy-100">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold text-navy-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-600">Use the account your workspace administrator created for you.</p>
          <ActionForm action={signIn} className="mt-6 space-y-4">
            {({ state, pending }) => (
              <>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input id="email" name="email" type="email" autoComplete="email" required className="input" />
                </div>
                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
                </div>
                <FormMessage state={state} />
                <button type="submit" disabled={pending} className="btn-primary w-full">
                  {pending ? "Signing in…" : "Sign in"}
                </button>
              </>
            )}
          </ActionForm>
        </div>
      </section>
    </main>
  );
}
