"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card border-red-200">
      <h1 className="text-lg font-semibold text-red-800">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-600">The page could not be loaded. Check your connection and try again.</p>
      <button onClick={reset} className="btn-primary mt-4">Try again</button>
    </div>
  );
}
