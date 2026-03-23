"use client";

import { useState } from "react";

interface SizeRequestLinkProps {
  page: "packs" | "quick-export";
}

export function SizeRequestLink({ page }: SizeRequestLinkProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!value.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/size-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: value.trim(), page }),
      });
    } catch {
      // fail silent
    }
    setSending(false);
    setSent(true);
    setValue("");
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 2000);
  }

  if (sent) {
    return (
      <p className="text-center text-[11px] text-success/70">
        Thanks! We&apos;ll look into it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center text-[11px] text-foreground/30 transition-colors hover:text-accent-light"
      >
        Missing a size? Let us know
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder='e.g. "5x5 square"'
        className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground placeholder:text-foreground/25 focus:border-accent/50 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={!value.trim() || sending}
        className="h-7 rounded-md bg-accent/15 px-2.5 text-[11px] font-medium text-accent-light transition-colors hover:bg-accent/25 disabled:opacity-40"
      >
        Send
      </button>
      <button
        onClick={() => setOpen(false)}
        className="h-7 px-1 text-[11px] text-foreground/30 transition-colors hover:text-foreground/50"
      >
        &times;
      </button>
    </div>
  );
}
