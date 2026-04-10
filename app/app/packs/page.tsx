"use client";

import React, { useState, useEffect, useMemo, useReducer, useRef } from "react";
import { useUser, SignedOut } from "@clerk/nextjs";
import { UploadZone } from "../components/UploadZone";
import { PackSelector, ALL_KEYS, PACKS } from "../components/PackSelector";
import type { Group } from "../components/PackSelector";
import { JobCard } from "../components/JobCard";
import type { Job, JobStatus } from "../components/JobCard";
import { GenerateButton } from "../components/GenerateButton";
import { XCircle, FolderDown, Check, Download, Upload, Layers, X } from "lucide-react";
import { useQuota } from "../context/QuotaContext";
import { UpsellBanner } from "../components/UpsellBanner";
import { SignupNudge } from "../components/SignupNudge";
import { SizeRequestLink } from "../components/SizeRequestLink";

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
  remaining?: { quick: number; batch: number };
  batchProgress?: { current: number; total: number };
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
  | { type: "set_remaining"; remaining?: { quick: number; batch: number } }
  | { type: "set_batch_progress"; current: number; total: number }
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
    case "set_remaining":
      return { ...state, remaining: action.remaining };
    case "set_batch_progress":
      return { ...state, batchProgress: { current: action.current, total: action.total } };
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
  const { setRemaining: setSharedRemaining } = useQuota();

  // Register free users in nurture email sequence on first visit (skip Pro)
  useEffect(() => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    if (isPro) return; // Pro users don't need nurture emails
    const email = user.primaryEmailAddress.emailAddress;
    const flagKey = `app_signup_registered:${user.id}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, "1");
    fetch("https://worker.snaptosize-mathias.workers.dev/app-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => { /* non-critical, ignore errors */ });
  }, [user?.id]);

  const selectedGroups = useMemo(
    () => ALL_KEYS.filter((g) => state.selected[g]),
    [state.selected],
  );

  // Handle download_error redirect from /api/download
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const downloadError = params.get("download_error");
    if (downloadError) {
      const messages: Record<string, string> = {
        not_found: "Download not found. The file may have been deleted.",
        expired: "Download link has expired. Please re-export.",
        quota: "Download blocked — quota exceeded.",
        download_failed: "Download failed. Please try again.",
      };
      dispatch({ type: "set_global_error", error: messages[downloadError] || messages.download_failed });
      const url = new URL(window.location.href);
      url.searchParams.delete("download_error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

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

  // ---- Poll a single job until terminal (done/error) or timeout ----
  async function pollOne(
    group: Group,
    jobId: string,
    signal: AbortSignal,
  ): Promise<"done" | "error"> {
    const start = Date.now();
    const timeoutMs = 5 * 60 * 1000;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;

    while (!signal.aborted) {
      if (Date.now() - start > timeoutMs) {
        dispatch({
          type: "set_job",
          job: { group, jobId, status: "error", error: "Taking longer than expected. Retry is safe — duplicates are automatically prevented." },
        });
        return "error";
      }

      try {
        const res = await fetch(
          `/api/status?job_id=${encodeURIComponent(jobId)}`,
          { signal },
        );

        if (res.ok) {
          consecutiveFailures = 0;
          const data = await res.json();

          if (isDone(data)) {
            dispatch({
              type: "set_job",
              job: { group, jobId, status: "done" },
            });
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
            return "done";
          } else if (isError(data)) {
            dispatch({
              type: "set_job",
              job: {
                group,
                jobId,
                status: "error",
                error: (data.error as string) || "Processing failed",
              },
            });
            return "error";
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
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            dispatch({
              type: "set_job",
              job: { group, jobId, status: "error", error: `Server error (HTTP ${res.status})` },
            });
            return "error";
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          dispatch({
            type: "set_job",
            job: { group, jobId, status: "error", error: "Lost connection to server" },
          });
          return "error";
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
    return "error";
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

      // Enqueue all selected packs sequentially; Worker enforces daily quota
      const toEnqueue = selectedGroups;

      // Sequential: enqueue one pack → poll until done/error → next pack
      dispatch({ type: "set_phase", phase: "polling" });
      let anySucceeded = false;

      for (let i = 0; i < toEnqueue.length; i++) {
        const group = toEnqueue[i];
        dispatch({ type: "set_batch_progress", current: i + 1, total: toEnqueue.length });
        dispatch({ type: "set_job", job: { group, status: "queued" } });

        const enqRes = await fetch("/api/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_key: imageKey, group, artwork_name: state.file.name }),
          signal: ac.signal,
        });

        if (!enqRes.ok) {
          const body = await safeText(enqRes);

          if (enqRes.status === 402) {
            // Lock this pack and all remaining unprocessed packs
            dispatch({
              type: "set_job",
              job: { group, status: "locked" as JobStatus },
            });
            for (const g of toEnqueue.slice(i + 1)) {
              dispatch({
                type: "set_job",
                job: { group: g, status: "locked" as JobStatus },
              });
            }
            dispatch({
              type: "set_global_error",
              error: "QUOTA:FREE_BATCH_LIMIT",
            });
            break;
          }

          if (enqRes.status === 429) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.error === "too_many_active_jobs") {
                dispatch({
                  type: "set_global_error",
                  error: parsed.message || "You have too many exports running. Please wait for current jobs to finish, then try again.",
                });
                return;
              }
            } catch { /* fall through to generic */ }
          }

          dispatch({
            type: "set_job",
            job: { group, status: "error", error: `HTTP ${enqRes.status}: ${body}` },
          });
          continue; // Skip to next pack
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

        if (enqData?.remaining) {
          dispatch({ type: "set_remaining", remaining: enqData.remaining });
          setSharedRemaining(enqData.remaining);
        }

        dispatch({ type: "set_job", job: { group, jobId, status: "queued" } });

        // Poll this single pack until done or error before moving to next
        const result = await pollOne(group, jobId, ac.signal);
        if (result === "done") anySucceeded = true;
      }

      if (!anySucceeded && toEnqueue.length > 0) {
        dispatch({ type: "set_phase", phase: "error" });
        return;
      }

      dispatch({ type: "set_phase", phase: "done" });
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
            isPro={isPro}
          />

          <PackSelector
            selected={state.selected}
            onToggle={(group, value) =>
              dispatch({ type: "toggle_group", group, value })
            }
            onSelectAll={(value) => dispatch({ type: "select_all", value })}
            disabled={busy}
            remainingBatch={state.remaining?.batch}
          />

          <p className="text-xs text-foreground/35">
            Need A0, 24×36, or 24×32?{" "}
            <a href="/app/quick-export" className="text-accent-light hover:underline">
              Export them individually
            </a>
          </p>

          <SizeRequestLink page="packs" />

          <div className="space-y-2">
            <GenerateButton
              disabled={!state.file || noneSelected || busy || state.globalError === "QUOTA:FREE_BATCH_LIMIT"}
              loading={busy}
              onClick={generate}
            />

            {/* Remaining packs badge (critical threshold only) */}
            {!busy && !state.globalError && state.remaining && state.remaining.batch <= 1 && (
              <p className="text-center text-xs font-medium">
                <span className="gradient-btn inline-block rounded-full px-3 py-1">
                  {state.remaining.batch} {state.remaining.batch === 1 ? 'pack' : 'packs'} remaining today
                </span>
              </p>
            )}

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

            {/* Batch progress */}
            {busy && state.batchProgress && state.batchProgress.total > 1 && (
              <p className="text-center text-xs font-medium text-foreground/50">
                Processing {state.batchProgress.current} of {state.batchProgress.total}…
              </p>
            )}

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
            <OnboardingHint phase={state.phase} />
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

          {/* Post-export banners */}
          {state.phase === "done" && (
            <>
              <SignedOut>
                <SignupNudge />
              </SignedOut>
              {user && !isPro && (
                <UpsellBanner mode="packs" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Hint -- dismissible 3-step guide, hides after first successful export
// ---------------------------------------------------------------------------

const ONBOARDING_KEY = "onboarding_dismissed";

function OnboardingHint({ phase }: { phase: Phase }) {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Read localStorage only after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable (private browsing) -- show hint anyway
    }
  }, []);

  // Auto-dismiss after first successful export
  useEffect(() => {
    if (phase === "done") {
      try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
      setDismissed(true);
    }
  }, [phase]);

  function dismiss() {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  const steps: { icon: React.ElementType; text: string }[] = [
    { icon: Upload,   text: "Upload your Etsy artwork" },
    { icon: Layers,   text: "Select your sizes" },
    { icon: Download, text: "Download all sizes as ZIP" },
  ];

  return (
    <div style={{ background: "#0B0B12", border: "1px solid rgba(45,212,191,0.2)", borderRadius: 12, padding: "14px 16px", position: "relative" }}>
      <button
        onClick={dismiss}
        aria-label="Dismiss onboarding hint"
        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", lineHeight: 1, padding: 2 }}
      >
        <X size={14} />
      </button>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2DD4BF", marginBottom: 10, opacity: 0.8 }}>
        How it works
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && (
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginRight: 2 }}>&#8594;</span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 6, background: "rgba(45,212,191,0.15)", flexShrink: 0 }}>
              <step.icon size={11} color="#2DD4BF" />
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{step.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
