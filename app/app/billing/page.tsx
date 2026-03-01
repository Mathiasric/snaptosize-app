"use client";

import { Suspense, useEffect, useState } from "react";
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

  const [loading, setLoading] = useState<"monthly" | "yearly" | "portal" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const reset = () => setLoading(null);
    window.addEventListener("focus", reset);
    return () => window.removeEventListener("focus", reset);
  }, []);

  // Fire-and-forget billing analytics
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/analytics/billing-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: source || undefined,
        kind: kind || undefined,
        success,
        canceled,
      }),
    }).catch(() => {});
  }, [isLoaded, user, source, kind, success, canceled]);

  async function checkout(interval: "monthly" | "yearly") {
    setLoading(interval);
    setActionError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, source: source || undefined, kind: kind || undefined }),
      });
      if (!res.ok) throw new Error("Checkout failed. Please try again.");
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned.");
      window.location.href = url;
    } catch (e) {
      setLoading(null);
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function openPortal() {
    setLoading("portal");
    setActionError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error("Couldn\u2019t open billing portal. Try again.");
      const { url } = await res.json();
      if (!url) throw new Error("No portal URL returned.");
      window.location.href = url;
    } catch (e) {
      setLoading(null);
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Unlock Unlimited Exports</h1>
        <p className="mt-1 text-sm text-foreground/40">
          Go Pro to remove limits and export without watermarks.
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
      <div className={`rounded-xl border p-5 ${isPro ? "border-accent/30 bg-accent/5" : "border-border bg-surface"}`}>
        <div className="flex items-center gap-2">
          {isPro ? (
            <CheckCircle2 size={16} className="text-accent-light" />
          ) : (
            <Crown size={16} className="text-foreground/30" />
          )}
          <span className="text-sm font-semibold text-foreground">
            Current plan
          </span>
        </div>
        <p className="mt-1 text-lg font-bold text-foreground">
          {!isLoaded ? "..." : isPro ? "Pro active" : "Free"}
        </p>
        {isPro && (
          <p className="mt-1 text-xs text-foreground/50">
            Unlimited exports unlocked. Thank you for supporting SnapToSize!
          </p>
        )}
        {isLoaded && !isPro && (
          <p className="mt-1 text-xs text-foreground/40">
            Limits: 3 Quick Exports/day &bull; 1 Pack/day
          </p>
        )}
      </div>

      {/* Manage subscription — Pro only */}
      {isLoaded && isPro && (
        <div className="space-y-3">
          <button
            onClick={openPortal}
            disabled={loading !== null}
            className="w-full rounded-xl border border-border bg-surface p-4 text-sm font-semibold text-foreground transition-colors hover:border-accent/30"
          >
            {loading === "portal" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={14} className="animate-spin" /> Opening portal…
              </span>
            ) : (
              "Manage subscription"
            )}
          </button>
          {actionError && (
            <p className="text-xs text-red-400">{actionError}</p>
          )}
        </div>
      )}

      {/* Upgrade cards — only show if not Pro */}
      {isLoaded && !isPro && (
        <div className="space-y-3">
          {/* Yearly — primary */}
          <button
            onClick={() => checkout("yearly")}
            disabled={loading !== null}
            className="group relative w-full rounded-xl border border-accent/30 bg-surface p-5 text-left transition-colors hover:border-accent/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-accent-light" />
                  <span className="text-sm font-semibold text-foreground">
                    Pro Yearly
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Best value
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Save 33%
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/40">
                  $97 / year &mdash; $8.08 / month, billed annually. Cancel anytime.
                </p>
              </div>
              <div className="shrink-0 text-right">
                {loading === "yearly" ? (
                  <Loader size={16} className="animate-spin text-accent-light" />
                ) : (
                  <span className="gradient-btn inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white">
                    Go Pro — Save 33%
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Monthly — secondary */}
          <button
            onClick={() => checkout("monthly")}
            disabled={loading !== null}
            className="group relative w-full rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-foreground/30" />
                  <span className="text-sm font-semibold text-foreground">
                    Pro Monthly
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/40">
                  $11.99 / month. Cancel anytime.
                </p>
              </div>
              <div className="shrink-0 text-right">
                {loading === "monthly" ? (
                  <Loader size={16} className="animate-spin text-accent-light" />
                ) : (
                  <span className="inline-block rounded-lg border border-accent/30 px-4 py-1.5 text-xs font-semibold text-foreground/70">
                    Go Pro Monthly
                  </span>
                )}
              </div>
            </div>
          </button>

          {actionError && (
            <p className="text-xs text-red-400">{actionError}</p>
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
