"use client";

import { useMemo, useReducer, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { UploadZone } from "../components/UploadZone";
import { PackSelector, ALL_KEYS, PACKS } from "../components/PackSelector";
import type { Group } from "../components/PackSelector";
import { JobCard } from "../components/JobCard";
import type { Job, JobStatus } from "../components/JobCard";
import { GenerateButton } from "../components/GenerateButton";
import { XCircle, FolderDown, Check, Download, Clock as ClockIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "uploading" | "enqueuing" | "polling" | "done" | "error";

interface RecentDownload {
  label: string;
  completedAt: number;
  downloadUrl: string;
  jobId: string;
}

type State = {
  phase: Phase;
  file: File | null;
  selected: Record<Group, boolean>;
  imageKey?: string;
  jobs: Partial<Record<Group, Job>>;
  globalError?: string;
  recentDownloads: RecentDownload[];
};

type Action =
  | { type: "set_file"; file: File | null }
  | { type: "toggle_group"; group: Group; value: boolean }
  | { type: "select_all"; value: boolean }
  | { type: "set_phase"; phase: Phase }
  | { type: "set_image_key"; imageKey: string }
  | { type: "set_job"; job: Job }
  | { type: "set_global_error"; error: string }
  | { type: "add_recent_download"; download: RecentDownload }
  | { type: "reset" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INIT_SELECTED: Record<Group, boolean> = {
  "2x3": false,
  "3x4": false,
  "4x5": false,
  iso: false,
  extras: false,
};

const INITIAL_STATE: State = {
  phase: "idle",
  file: null,
  selected: { ...INIT_SELECTED },
  jobs: {},
  globalError: undefined,
  recentDownloads: [],
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_file":
      return { ...state, file: action.file };
    case "toggle_group":
      return { ...state, selected: { ...state.selected, [action.group]: action.value } };
    case "select_all": {
      const next = { ...state.selected };
      for (const k of ALL_KEYS) next[k] = action.value;
      return { ...state, selected: next };
    }
    case "set_phase":
      return { ...state, phase: action.phase };
    case "set_image_key":
      return { ...state, imageKey: action.imageKey };
    case "set_job":
      return { ...state, jobs: { ...state.jobs, [action.job.group]: action.job } };
    case "set_global_error":
      return { ...state, globalError: action.error, phase: "error" };
    case "add_recent_download": {
      const updated = [action.download, ...state.recentDownloads].slice(0, 5);
      return { ...state, recentDownloads: updated };
    }
    case "reset":
      return { ...INITIAL_STATE, file: state.file, selected: state.selected, recentDownloads: state.recentDownloads };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function isDone(data: Record<string, unknown>): boolean {
  return data.state === "done" || data.status === "done" || data.done === true;
}

function isError(data: Record<string, unknown>): boolean {
  return data.state === "error" || data.status === "error";
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useUser();
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === "pro";

  const selectedGroups = useMemo(
    () => ALL_KEYS.filter((g) => state.selected[g]),
    [state.selected],
  );

  const busy =
    state.phase === "uploading" ||
    state.phase === "enqueuing" ||
    state.phase === "polling";

  const noneSelected = ALL_KEYS.every((k) => !state.selected[k]);

  // ---- Abort ----
  function abort() {
    abortRef.current?.abort();
    dispatch({ type: "set_phase", phase: "idle" });
  }

  // ---- Reset ----
  function reset() {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }

  // ---- Poll ----
  async function pollAll(
    enqueued: { group: Group; jobId: string }[],
    signal: AbortSignal,
  ) {
    const start = Date.now();
    const timeoutMs = 3 * 60 * 1000;
    const terminal = new Set<string>();

    while (!signal.aborted) {
      if (Date.now() - start > timeoutMs) {
        dispatch({ type: "set_phase", phase: "done" });
        return;
      }

      if (terminal.size >= enqueued.length) {
        dispatch({ type: "set_phase", phase: "done" });
        return;
      }

      for (const { group, jobId } of enqueued) {
        if (terminal.has(jobId)) continue;

        const res = await fetch(
          `/api/status?job_id=${encodeURIComponent(jobId)}`,
          { signal },
        );

        if (!res.ok) continue;

        const data = await res.json();

        if (isDone(data)) {
          terminal.add(jobId);
          dispatch({
            type: "set_job",
            job: { group, jobId, status: "done" },
          });
          // Add to recent downloads
          const pack = PACKS.find((p) => p.key === group);
          dispatch({
            type: "add_recent_download",
            download: {
              label: pack?.label ?? group,
              completedAt: Date.now(),
              downloadUrl: `/api/download?job_id=${encodeURIComponent(jobId)}`,
              jobId,
            },
          });
        } else if (isError(data)) {
          terminal.add(jobId);
          dispatch({
            type: "set_job",
            job: {
              group,
              jobId,
              status: "error",
              error: (data.error as string) || "Processing failed",
            },
          });
        } else {
          const s: JobStatus =
            data.status === "queued" || data.state === "queued"
              ? "queued"
              : "running";
          dispatch({
            type: "set_job",
            job: { group, jobId, status: s },
          });
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---- Main flow ----
  async function generate() {
    if (!state.file || selectedGroups.length === 0) return;

    dispatch({ type: "reset" });
    dispatch({ type: "set_file", file: state.file });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Upload
      dispatch({ type: "set_phase", phase: "uploading" });

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": state.file.type || "application/octet-stream" },
        body: await state.file.arrayBuffer(),
        signal: ac.signal,
      });

      if (!uploadRes.ok) {
        dispatch({ type: "set_global_error", error: "Upload failed. Please try again." });
        return;
      }

      const uploadData = await uploadRes.json();
      const imageKey = uploadData?.image_key as string | undefined;
      if (!imageKey) {
        dispatch({ type: "set_global_error", error: "Upload returned no image key." });
        return;
      }
      dispatch({ type: "set_image_key", imageKey });

      // Enqueue
      dispatch({ type: "set_phase", phase: "enqueuing" });
      const enqueued: { group: Group; jobId: string }[] = [];

      // Free/guest users: only enqueue first pack, lock the rest
      const toEnqueue = isPro ? selectedGroups : selectedGroups.slice(0, 1);
      if (!isPro && selectedGroups.length > 1) {
        for (const g of selectedGroups.slice(1)) {
          dispatch({ type: "set_job", job: { group: g, status: "locked" as JobStatus } });
        }
      }

      for (const group of toEnqueue) {
        dispatch({ type: "set_job", job: { group, status: "queued" } });

        const enqRes = await fetch("/api/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_key: imageKey, group }),
          signal: ac.signal,
        });

        if (!enqRes.ok) {
          const body = await safeText(enqRes);

          if (enqRes.status === 402) {
            dispatch({
              type: "set_job",
              job: { group, status: "error", error: "Free limit reached" },
            });
            dispatch({
              type: "set_global_error",
              error: "QUOTA:FREE_BATCH_LIMIT",
            });
            return;
          }

          dispatch({
            type: "set_job",
            job: { group, status: "error", error: `HTTP ${enqRes.status}: ${body}` },
          });
          continue;
        }

        const enqData = await enqRes.json();
        const jobId = enqData?.job_id as string | undefined;
        if (!jobId) {
          dispatch({
            type: "set_job",
            job: { group, status: "error", error: "No job_id returned" },
          });
          continue;
        }

        enqueued.push({ group, jobId });
        dispatch({ type: "set_job", job: { group, jobId, status: "queued" } });
      }

      if (enqueued.length === 0) {
        dispatch({ type: "set_phase", phase: "error" });
        return;
      }

      // Poll
      dispatch({ type: "set_phase", phase: "polling" });
      await pollAll(enqueued, ac.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: "set_global_error", error: msg });
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const hasJobs = Object.keys(state.jobs).length > 0;

  // Filter out current jobs from recent downloads to avoid duplication
  const currentJobIds = new Set(
    Object.values(state.jobs).map((j) => j.jobId).filter(Boolean)
  );
  const previousDownloads = state.recentDownloads.filter(
    (item) => !currentJobIds.has(item.jobId)
  );

  return (
    <div className="min-h-screen px-4 pb-16 pt-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input Panel */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <UploadZone
            file={state.file}
            onFileChange={(f) => dispatch({ type: "set_file", file: f })}
            disabled={busy}
          />

          <PackSelector
            selected={state.selected}
            onToggle={(group, value) =>
              dispatch({ type: "toggle_group", group, value })
            }
            onSelectAll={(value) => dispatch({ type: "select_all", value })}
            disabled={busy}
          />

          <div className="space-y-2">
            <GenerateButton
              disabled={!state.file || noneSelected || busy || state.globalError === "QUOTA:FREE_BATCH_LIMIT"}
              loading={busy}
              onClick={generate}
            />

            {/* Micro-copy: conversion trust signals */}
            {!busy && !state.globalError && (
              <p className="flex items-center justify-center gap-3 text-xs text-foreground/30">
                <span className="flex items-center gap-1"><Check size={10} className="text-accent/60" />300 DPI</span>
                <span className="flex items-center gap-1"><Check size={10} className="text-accent/60" />Print-ready</span>
                <span className="flex items-center gap-1"><Check size={10} className="text-accent/60" />Instant ZIP</span>
              </p>
            )}

            {/* Inline error under generate */}
            {state.globalError === "QUOTA:FREE_BATCH_LIMIT" ? (
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">You&apos;ve reached today&apos;s free limit.</p>
                <p className="mt-1 text-xs text-foreground/50">
                  Unlock unlimited exports, all ZIP packs, and watermark-free downloads.
                </p>
                <a
                  href="/app/billing?source=limit&kind=FREE_BATCH_LIMIT"
                  className="gradient-btn mt-2 inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                >
                  Unlock Pro
                </a>
              </div>
            ) : state.globalError ? (
              <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                <XCircle size={14} className="mt-0.5 shrink-0 text-error" />
                <p className="text-xs text-error/90">{state.globalError}</p>
              </div>
            ) : null}

            {/* Cancel / Reset */}
            {busy && (
              <button
                onClick={abort}
                className="w-full rounded-lg border border-error/30 py-2 text-xs font-medium text-error transition-colors hover:bg-error/10"
              >
                Cancel
              </button>
            )}
            {!busy && state.phase !== "idle" && (
              <button
                onClick={reset}
                className="w-full rounded-lg border border-border py-2 text-xs font-medium text-foreground/50 transition-colors hover:border-foreground/20 hover:text-foreground/70"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Right: Output Panel */}
        <div className="space-y-3">
          {hasJobs ? (
            selectedGroups.map((g) => {
              const job = state.jobs[g];
              if (!job) return null;
              return <JobCard key={g} group={g} job={job} />;
            })
          ) : (
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-accent/10 p-1.5">
                  <FolderDown size={16} className="text-accent-light" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-foreground">
                    Your Etsy-ready ZIP packs will appear here.
                  </h3>
                  <p className="mt-0.5 text-xs leading-tight text-foreground/40">
                    Select packs and click Generate.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      300 DPI print-ready
                    </li>
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      Exact aspect ratios
                    </li>
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      Etsy-friendly file names
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Recent Downloads */}
          {previousDownloads.length > 0 && (
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Recent Downloads
              </h3>
              <p className="mb-3 text-xs text-foreground/30">
                Visible until you refresh this page.
              </p>
              <div className="space-y-2">
                {previousDownloads.map((item) => (
                  <div
                    key={item.jobId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-foreground/40">
                        {formatRelativeTime(item.completedAt)}
                      </p>
                    </div>
                    <a
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/25"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
