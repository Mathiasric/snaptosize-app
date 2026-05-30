"use client";

import { Sparkles } from "lucide-react";
import { usePostHog } from "posthog-js/react";

interface PaywallInterstitialProps {
  kind: "FREE_BATCH_LIMIT" | "FREE_QUICK_LIMIT";
}

const COPY = {
  FREE_BATCH_LIMIT: {
    headline: "You've used your 2 free ZIP packs for today.",
    body: "Etsy sellers on Pro never stop mid-listing. Unlimited exports, no watermark, every size — keep going now.",
    cta: "Continue with Pro",
  },
  FREE_QUICK_LIMIT: {
    headline: "You've used your 5 free exports for today.",
    body: "Pro sellers export as many files as their listings need. Unlimited exports, no watermark, no reset panic.",
    cta: "Continue with Pro",
  },
} as const;

export function PaywallInterstitial({ kind }: PaywallInterstitialProps) {
  const { headline, body, cta } = COPY[kind];
  const href = `/app/billing?source=limit&kind=${kind}`;
  const posthog = usePostHog();

  function handleCtaClick() {
    posthog?.capture("paywall_cta_clicked", { kind, source: "interstitial" });
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-lg bg-accent/15 p-2">
          <Sparkles size={16} className="text-accent-light" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/50">{body}</p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href={href}
              onClick={handleCtaClick}
              className="gradient-btn inline-block rounded-lg px-5 py-2 text-sm font-semibold text-white"
            >
              {cta} →
            </a>
            <span className="text-xs text-foreground/30">Resets at midnight</span>
          </div>
        </div>
      </div>
    </div>
  );
}
