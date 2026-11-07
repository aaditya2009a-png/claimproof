import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function NoAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md text-center">
        <h1 className="text-xl font-semibold">No workspace access</h1>
        <p className="mt-2 text-sm text-slate-600">
          {user.email} is signed in but is not a member of any workspace. Ask a workspace administrator to add you.
        </p>
        <form action={signOut} className="mt-4">
          <button className="btn-secondary">Sign out</button>
        </form>
      </div>
    </main>
  );
}
