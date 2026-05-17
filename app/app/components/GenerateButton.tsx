"use client";

import { Loader, Sparkles } from "lucide-react";

interface GenerateButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  label?: string;
  loadingLabel?: string;
}

export function GenerateButton({
  disabled,
  loading,
  onClick,
  label = "Generate",
  loadingLabel = "Generating...",
}: GenerateButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`gradient-btn flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:shadow-lg hover:shadow-accent/20"
      }`}
    >
      {loading ? (
        <>
          <Loader size={16} className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Sparkles size={16} />
          {label}
        </>
      )}
    </button>
  );
}
