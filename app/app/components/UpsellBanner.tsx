// app/app/components/UpsellBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import Link from "next/link";

interface UpsellBannerProps {
  /** "packs" or "quick-export" — determines CTA copy */
  mode: "packs" | "quick-export";
}

const SESSION_KEY = "upsell_banner_dismissed";

export function UpsellBanner({ mode }: UpsellBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(!!sessionStorage.getItem(SESSION_KEY));
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  const message =
    mode === "packs"
      ? "That took 30 seconds."
      : "Your print-ready file is ready.";

  return (
    <div className="relative rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-foreground/30 transition-colors hover:text-foreground/60"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 rounded-md bg-accent/15 p-1.5">
          <Sparkles size={14} className="text-accent-light" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {message}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            Your Etsy listing won&apos;t show the watermark with Pro — download files you can actually sell with.
          </p>
          <Link
            href="/app/billing?source=post_export"
            className="gradient-btn mt-2 inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
          >
            Unlock Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
