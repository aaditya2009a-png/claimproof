import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Nav role={s.role} name={s.displayName} workspace={s.workspaceName} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        ClaimProof produces a review record, not a legal certificate. Demo data is fictional.
      </footer>
    </div>
  );
}
