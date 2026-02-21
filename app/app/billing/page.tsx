"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, XCircle, Crown, Loader, Sparkles } from "lucide-react";

function BillingContent() {
  const params = useSearchParams();
  const { user, isLoaded } = useUser();
  const plan = (user?.publicMetadata as { plan?: string } | undefined)?.plan;
  const isPro = plan === "pro";

  const success = params.get("success") === "1";
  const canceled = params.get("canceled") === "1";
  const source = params.get("source");
  const kind = params.get("kind");

  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function checkout(interval: "monthly" | "yearly") {
    setLoading(interval);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      if (!res.ok) throw new Error("Checkout failed. Please try again.");
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned.");
      window.location.href = url;
    } catch (e) {
      setLoading(null);
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-foreground/40">
          Manage your SnapToSize subscription.
        </p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Payment received
            </p>
            <p className="mt-0.5 text-xs text-foreground/50">
              Your Pro plan is activating. This usually takes a few seconds.
              Refresh the page if it hasn&apos;t updated yet.
            </p>
          </div>
        </div>
      )}

      {/* Canceled banner */}
      {canceled && (
        <div className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-surface p-4">
          <XCircle size={18} className="mt-0.5 shrink-0 text-foreground/40" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Checkout canceled
            </p>
            <p className="mt-0.5 text-xs text-foreground/50">
              No charges were made. You can try again anytime.
            </p>
          </div>
        </div>
      )}

      {/* Limit hit banner */}
      {source === "limit" && !isPro && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-light" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              You hit today&apos;s free limit
            </p>
            <p className="mt-0.5 text-xs text-foreground/50">
              {kind === "FREE_QUICK_LIMIT"
                ? "You\u2019ve used all 3 free Quick Exports for today."
                : kind === "FREE_BATCH_LIMIT"
                  ? "You\u2019ve used your 1 free ZIP pack for today."
                  : "Upgrade to Pro to continue without limits."}
            </p>
          </div>
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Crown
            size={16}
            className={isPro ? "text-accent-light" : "text-foreground/30"}
          />
          <span className="text-sm font-semibold text-foreground">
            Current plan
          </span>
        </div>
        <p className="mt-1 text-lg font-bold text-foreground">
          {!isLoaded ? "..." : isPro ? "Pro" : "Free"}
        </p>
        {isPro && (
          <p className="mt-1 text-xs text-foreground/40">
            Unlimited packs and quick exports. Thank you for supporting
            SnapToSize!
          </p>
        )}
        {isLoaded && !isPro && (
          <p className="mt-1 text-xs text-foreground/40">
            Limits: 3 Quick Exports/day &bull; 1 Pack/day
          </p>
        )}
      </div>

      {/* Upgrade cards — only show if not Pro */}
      {isLoaded && !isPro && (
        <div className="space-y-3">
          {/* Monthly */}
          <button
            onClick={() => checkout("monthly")}
            disabled={loading !== null}
            className="group relative w-full rounded-xl border border-accent/30 bg-surface p-5 text-left transition-colors hover:border-accent/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-accent-light" />
                  <span className="text-sm font-semibold text-foreground">
                    Pro Monthly
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/40">
                  Unlimited ZIP packs &amp; quick exports. Cancel anytime.
                </p>
              </div>
              <div className="shrink-0 text-right">
                {loading === "monthly" ? (
                  <Loader size={16} className="animate-spin text-accent-light" />
                ) : (
                  <span className="gradient-btn inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white">
                    Upgrade
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Yearly */}
          <button
            onClick={() => checkout("yearly")}
            disabled={loading !== null}
            className="group relative w-full rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-foreground/30" />
                  <span className="text-sm font-semibold text-foreground">
                    Pro Yearly
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Save 33%
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/40">
                  Best value. Billed annually. Cancel anytime.
                </p>
              </div>
              <div className="shrink-0 text-right">
                {loading === "yearly" ? (
                  <Loader size={16} className="animate-spin text-accent-light" />
                ) : (
                  <span className="inline-block rounded-lg border border-accent/30 px-4 py-1.5 text-xs font-semibold text-foreground/70">
                    Upgrade
                  </span>
                )}
              </div>
            </div>
          </button>

          {checkoutError && (
            <p className="text-xs text-red-400">{checkoutError}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <div className="min-h-screen px-4 pb-16 pt-8">
      <Suspense>
        <BillingContent />
      </Suspense>
    </div>
  );
}
