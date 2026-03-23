// app/app/components/SignupNudge.tsx
"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import Link from "next/link";

export function SignupNudge() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative rounded-xl border border-accent/20 bg-surface px-4 py-3">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-full p-1 text-foreground/30 transition-colors hover:text-foreground/60"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 rounded-md bg-accent/15 p-1.5">
          <UserPlus size={14} className="text-accent-light" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Create a free account to track your exports
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            Save your download history and get 2 free packs + 5 exports every day.
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-block rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-light"
          >
            Sign up free
          </Link>
        </div>
      </div>
    </div>
  );
}
