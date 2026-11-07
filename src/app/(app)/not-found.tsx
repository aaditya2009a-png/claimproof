import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-slate-600">This page does not exist, or you do not have access to it.</p>
      <Link href="/dashboard" className="btn-secondary mt-4">Back to dashboard</Link>
    </div>
  );
}
