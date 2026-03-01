"use client";

import { useState } from "react";
import { Download, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Loader, Lock } from "lucide-react";
import type { Group } from "./PackSelector";
import { PACKS } from "./PackSelector";

export type JobStatus = "idle" | "queued" | "running" | "done" | "error" | "locked";

export interface Job {
  group: Group;
  jobId?: string;
  status: JobStatus;
  error?: string;
}

interface JobCardProps {
  group: Group;
  job: Job;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  idle: {
    label: "Idle",
    color: "text-foreground/40",
    bg: "bg-foreground/5",
    border: "border-border",
    icon: <Clock size={12} />,
  },
  queued: {
    label: "Queued",
    color: "text-foreground/50",
    bg: "bg-foreground/5",
    border: "border-border",
    icon: <Clock size={12} />,
  },
  running: {
    label: "Processing",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/30",
    icon: <Loader size={12} className="animate-spin" />,
  },
  done: {
    label: "Ready",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    icon: <CheckCircle2 size={12} />,
  },
  error: {
    label: "Failed",
    color: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    icon: <AlertCircle size={12} />,
  },
  locked: {
    label: "Pro",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/30",
    icon: <Lock size={12} />,
  },
};

export function JobCard({ group, job, onRetry }: JobCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pack = PACKS.find((p) => p.key === group);
  const config = STATUS_CONFIG[job.status];
  const showDebug =
    process.env.NODE_ENV !== "production" ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1");
  const label = pack?.label ?? group;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        job.status === "done"
          ? "border-success/20 bg-surface"
          : job.status === "error"
            ? "border-error/20 bg-surface"
            : job.status === "locked"
              ? "border-accent/20 bg-surface"
              : "border-border bg-surface"
      }`}
    >
      {/* Header row: title + pill */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.bg} ${config.border}`}
        >
          {config.icon}
          {config.label}
        </span>
      </div>

      {/* Ready state */}
      {job.status === "done" && job.jobId && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-success/70">
            Your {label} pack is ready.
          </p>
          <a
            href={`/api/download?job_id=${encodeURIComponent(job.jobId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success/15 px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/25"
          >
            <Download size={16} />
            Download ZIP
          </a>
        </div>
      )}

      {/* Error state */}
      {job.status === "error" && (
        <div className="mt-3">
          {job.error && (
            <p className="mb-2 text-xs text-error/70">{job.error}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-error/30 px-4 py-2 text-xs font-medium text-error transition-colors hover:bg-error/10"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Locked state — free user upsell */}
      {job.status === "locked" && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-foreground/40">
            You&apos;ve reached today&apos;s free limit. Unlock unlimited packs.
          </p>
          <a
            href="/app/billing?source=limit&kind=FREE_BATCH_LIMIT"
            className="gradient-btn inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white"
          >
            <Lock size={14} />
            Unlock Pro
          </a>
        </div>
      )}

      {/* Dev debug (collapsed) */}
      {showDebug && (job.jobId || job.error) && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-1 text-xs text-foreground/30 transition-colors hover:text-foreground/50"
          >
            {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Debug
          </button>
          {detailsOpen && (
            <div className="mt-2 rounded-md bg-background/50 p-2 font-mono text-xs text-foreground/30">
              {job.jobId && <div>jobId: {job.jobId}</div>}
              <div>status: {job.status}</div>
              {job.error && <div>error: {job.error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
