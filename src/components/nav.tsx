import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", creator: "Creator", reviewer: "Reviewer" };

// Hiding links is only a convenience. Permissions are enforced on the server and in Supabase RLS.
export function Nav({ role, name, workspace }: { role: Role; name: string; workspace: string }) {
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/sources", label: "Sources" },
    ...(role !== "reviewer" ? [{ href: "/submissions/new", label: "New submission" }] : []),
    ...(role !== "creator" ? [{ href: "/queue", label: "Reviewer queue" }] : []),
  ];
  return (
    <header className="sticky top-0 z-10 border-b-2 border-teal-600 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-600 text-sm" aria-hidden="true">✓</span>
          <span>Claim<span className="text-teal-500">Proof</span></span>
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <div className="text-white">{name}</div>
            <div className="text-xs text-navy-100">{workspace}</div>
          </div>
          <span className="rounded-full bg-teal-600/20 px-2.5 py-0.5 text-xs font-medium text-teal-100">{ROLE_LABEL[role]}</span>
          <form action={signOut}>
            <button className="rounded-md border border-navy-600 px-3 py-1 text-navy-100 hover:bg-navy-800">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
