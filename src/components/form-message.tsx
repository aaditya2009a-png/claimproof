import type { FormState } from "@/lib/types";

export function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-700">
        {state.ok}
      </p>
    );
  return null;
}
