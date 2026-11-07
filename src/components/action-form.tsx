"use client";
import { startTransition, useActionState } from "react";
import type { FormState } from "@/lib/types";

/**
 * Runs a server action without React 19's automatic form reset, so a long draft
 * is never wiped when validation fails.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  className?: string;
  children: (ctx: { state: FormState; pending: boolean }) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {children({ state, pending })}
    </form>
  );
}
