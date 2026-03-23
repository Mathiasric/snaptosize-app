"use client";

import { useState, useEffect } from "react";
import { X, Upload, Layers, Download } from "lucide-react";

const STORAGE_KEY = "snaptosize_onboarding_dismissed";

interface OnboardingBannerProps {
  mode: "packs" | "quick-export";
}

export function OnboardingBanner({ mode }: OnboardingBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const steps =
    mode === "packs"
      ? [
          { icon: Upload, text: "Upload your artwork" },
          { icon: Layers, text: "Pick your ratio packs" },
          { icon: Download, text: "Download Etsy-ready ZIPs" },
        ]
      : [
          { icon: Upload, text: "Upload your artwork" },
          { icon: Layers, text: "Choose size and orientation" },
          { icon: Download, text: "Download a print-ready JPG" },
        ];

  return (
    <div className="relative rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-foreground/30 transition-colors hover:text-foreground/60"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p className="pr-6 text-sm font-medium text-foreground">
        Get print-ready files in seconds
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="mr-1 text-xs text-foreground/20">&rarr;</span>
            )}
            <div className="rounded-md bg-accent/15 p-1">
              <step.icon size={12} className="text-accent-light" />
            </div>
            <span className="text-xs text-foreground/60">{step.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
