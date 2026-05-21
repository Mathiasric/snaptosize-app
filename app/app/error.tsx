"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console for debugging; analytics capture happens app-side.
    console.error("[app] route error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <AlertTriangle size={22} />
      </span>
      <h1 className="text-lg font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/55">
        This view hit an unexpected error. Your files are safe — nothing was lost.
        Try again, and if it keeps happening, reload the page.
      </p>
      <button
        onClick={reset}
        className="gradient-btn mt-5 inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
