"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: ReactNode;
  pending: ReactNode;
  variant?: "primary" | "quiet";
}) {
  const status = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
