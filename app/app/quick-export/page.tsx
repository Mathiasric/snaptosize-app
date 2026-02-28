"use client";

import { useState, useReducer, useRef, useMemo } from "react";
import { UploadZone } from "../components/UploadZone";
import { GenerateButton } from "../components/GenerateButton";
import {
  XCircle,
  Download,
  FileImage,
  Check,
  RefreshCw,
  Clock,
  Loader,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  SIZE_CATALOG,
  SQUARE_SIZES,
  getSizesForGroup,
  getSizeLabel,
} from "../lib/size-catalog";
import type { CatalogGroup, Orientation } from "../lib/size-catalog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "uploading" | "enqueuing" | "polling" | "done" | "error";
type JobStatus = "queued" | "running" | "done" | "error";

interface JobInfo {
  jobId: string;
  status: JobStatus;
  downloadUrl?: string;
  error?: string;
}

interface RecentDownload {
  label: string;
  completedAt: number;
  downloadUrl: string;
  jobId: string;
}

interface State {
  phase: Phase;
  file: File | null;
  group: CatalogGroup;
  orientation: Orientation;
  sizeId: string;
  imageKey?: string;
  job?: JobInfo;
  globalError?: string;
  recentDownloads: RecentDownload[];
}

type Action =
  | { type: "set_file"; file: File | null }
  | { type: "set_group"; group: CatalogGroup }
  | { type: "set_orientation"; orientation: Orientation }
  | { type: "set_size"; sizeId: string }
  | { type: "set_phase"; phase: Phase }
  | { type: "set_image_key"; imageKey: string }
  | { type: "set_job"; job: JobInfo }
  | { type: "set_global_error"; error: string }
  | { type: "add_recent_download"; download: RecentDownload }
  | { type: "reset" };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const defaultGroup: CatalogGroup = "2x3";
const defaultSizes = getSizesForGroup(defaultGroup);

const INITIAL_STATE: State = {
  phase: "idle",
  file: null,
  group: defaultGroup,
  orientation: "Portrait",
  sizeId: defaultSizes[0]?.id ?? "",
  imageKey: undefined,
  job: undefined,
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
    case "set_group": {
      const sizes = getSizesForGroup(action.group);
      return { ...state, group: action.group, sizeId: sizes[0]?.id ?? "" };
    }
    case "set_orientation": {
      if (action.orientation === "Square") {
        return { ...state, orientation: action.orientation, sizeId: SQUARE_SIZES[0].id };
      }
      // Switching from Square back to Portrait/Landscape — reset to current group's first size
      if (state.orientation === "Square") {
        const sizes = getSizesForGroup(state.group);
        return { ...state, orientation: action.orientation, sizeId: sizes[0]?.id ?? "" };
      }
      return { ...state, orientation: action.orientation };
    }
    case "set_size":
      return { ...state, sizeId: action.sizeId };
    case "set_phase":
      return { ...state, phase: action.phase };
    case "set_image_key":
      return { ...state, imageKey: action.imageKey };
    case "set_job":
      return { ...state, job: action.job };
    case "set_global_error":
      return { ...state, globalError: action.error, phase: "error" };
    case "add_recent_download": {
      const updated = [action.download, ...state.recentDownloads].slice(0, 5);
      return { ...state, recentDownloads: updated };
    }
    case "reset":
      return {
        ...INITIAL_STATE,
        file: state.file,
        group: state.group,
        orientation: state.orientation,
        sizeId: state.sizeId,
        recentDownloads: state.recentDownloads,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export default function QuickExportPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const isSquare = state.orientation === "Square";
  const effectiveGroup = isSquare ? "SQUARE" : state.group;
  const sizes = useMemo(() => getSizesForGroup(effectiveGroup), [effectiveGroup]);
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === state.sizeId) ?? sizes[0],
    [sizes, state.sizeId],
  );

  const busy =
    state.phase === "uploading" ||
    state.phase === "enqueuing" ||
    state.phase === "polling";

  // Filter out current job from recent downloads to avoid duplication
  const previousDownloads = state.recentDownloads.filter(
    (item) => item.jobId !== state.job?.jobId
  );

  // ---- Poll single job ----
  async function pollJob(jobId: string, sizeLabel: string, signal: AbortSignal) {
    const start = Date.now();
    const timeoutMs = 3 * 60 * 1000;

    while (!signal.aborted) {
      if (Date.now() - start > timeoutMs) {
        dispatch({
          type: "set_job",
          job: { jobId, status: "error", error: "Timed out after 3 minutes" },
        });
        dispatch({ type: "set_phase", phase: "done" });
        return;
      }

      const res = await fetch(
        `/api/status?job_id=${encodeURIComponent(jobId)}`,
        { signal },
      );

      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const data = await res.json();

      if (isDone(data)) {
        const downloadUrl =
          (data.download_url as string) ||
          `/api/download?job_id=${encodeURIComponent(jobId)}`;
        dispatch({
          type: "set_job",
          job: { jobId, status: "done", downloadUrl },
        });
        // Add to recent downloads
        dispatch({
          type: "add_recent_download",
          download: {
            label: sizeLabel,
            completedAt: Date.now(),
            downloadUrl,
            jobId,
          },
        });
        dispatch({ type: "set_phase", phase: "done" });
        return;
      }

      if (isError(data)) {
        dispatch({
          type: "set_job",
          job: {
            jobId,
            status: "error",
            error: (data.error as string) || "Processing failed",
          },
        });
        dispatch({ type: "set_phase", phase: "done" });
        return;
      }

      const s: JobStatus =
        data.status === "queued" || data.state === "queued"
          ? "queued"
          : "running";
      dispatch({ type: "set_job", job: { jobId, status: s } });

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---- Export flow ----
  async function exportSingle() {
    if (!state.file || !selectedSize) return;

    dispatch({ type: "reset" });
    dispatch({ type: "set_file", file: state.file });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Upload
      dispatch({ type: "set_phase", phase: "uploading" });

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": state.file.type || "application/octet-stream",
        },
        body: await state.file.arrayBuffer(),
        signal: ac.signal,
      });

      if (!uploadRes.ok) {
        dispatch({
          type: "set_global_error",
          error: "Upload failed. Please try again.",
        });
        return;
      }

      const uploadData = await uploadRes.json();
      const imageKey = uploadData?.image_key as string | undefined;
      if (!imageKey) {
        dispatch({
          type: "set_global_error",
          error: "Upload returned no image key.",
        });
        return;
      }
      dispatch({ type: "set_image_key", imageKey });

      // Enqueue with mode: "single"
      dispatch({ type: "set_phase", phase: "enqueuing" });

      const enqRes = await fetch("/api/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_key: imageKey,
          group: effectiveGroup,
          mode: "single",
          orientation: state.orientation,
          size: selectedSize.id,
        }),
        signal: ac.signal,
      });

      if (!enqRes.ok) {
        const body = await enqRes.text().catch(() => "");
        if (enqRes.status === 402) {
          dispatch({
            type: "set_global_error",
            error: "QUOTA:FREE_QUICK_LIMIT",
          });
          return;
        }
        dispatch({
          type: "set_global_error",
          error: `Export failed: HTTP ${enqRes.status}${body ? ` - ${body}` : ""}`,
        });
        return;
      }

      const enqData = await enqRes.json();
      const jobId = enqData?.job_id as string | undefined;
      if (!jobId) {
        dispatch({
          type: "set_global_error",
          error: "No job_id returned from server.",
        });
        return;
      }

      dispatch({
        type: "set_job",
        job: { jobId, status: "queued" },
      });

      // Poll
      dispatch({ type: "set_phase", phase: "polling" });
      const sizeLabel = selectedSize
        ? getSizeLabel(selectedSize, state.orientation)
        : state.sizeId;
      await pollJob(jobId, sizeLabel, ac.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: "set_global_error", error: msg });
    }
  }

  function abort() {
    abortRef.current?.abort();
    dispatch({ type: "set_phase", phase: "idle" });
  }

  function reset() {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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

          {/* Orientation toggle */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Orientation
            </label>
            <div className="flex gap-2">
              {(["Portrait", "Landscape", "Square"] as const).map((o) => (
                <button
                  key={o}
                  disabled={busy}
                  onClick={() => dispatch({ type: "set_orientation", orientation: o })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    state.orientation === o
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground/70"
                  } ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Group selector — hidden when Square */}
          {!isSquare && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Ratio Group
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {SIZE_CATALOG.map((g) => (
                  <button
                    key={g.key}
                    disabled={busy}
                    onClick={() =>
                      dispatch({ type: "set_group", group: g.key })
                    }
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      state.group === g.key
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border text-foreground/50 hover:border-foreground/20 hover:text-foreground/70"
                    } ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size picker */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
              {isSquare ? "Square Size" : "Size"}
            </label>
            <select
              disabled={busy}
              value={state.sizeId}
              onChange={(e) =>
                dispatch({ type: "set_size", sizeId: e.target.value })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {getSizeLabel(s, state.orientation)}
                </option>
              ))}
            </select>
          </div>

          {/* Export button */}
          <div className="space-y-2">
            <GenerateButton
              disabled={!state.file || busy || state.globalError === "QUOTA:FREE_QUICK_LIMIT"}
              loading={busy}
              onClick={exportSingle}
              label="Export JPG"
              loadingLabel="Exporting..."
            />

            {!busy && !state.globalError && (
              <p className="flex items-center justify-center gap-3 text-xs text-foreground/30">
                <span className="flex items-center gap-1">
                  <Check size={10} className="text-accent/60" />
                  300 DPI
                </span>
                <span className="flex items-center gap-1">
                  <Check size={10} className="text-accent/60" />
                  Single JPG
                </span>
                <span className="flex items-center gap-1">
                  <Check size={10} className="text-accent/60" />
                  Instant download
                </span>
              </p>
            )}

            {state.globalError === "QUOTA:FREE_QUICK_LIMIT" ? (
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Upgrade to Pro</p>
                <p className="mt-1 text-xs text-foreground/50">
                  You&apos;ve used today&apos;s 3 free Quick Exports. Upgrade for unlimited exports.
                </p>
                <a
                  href="/app/billing?source=limit&kind=FREE_QUICK_LIMIT"
                  className="gradient-btn mt-2 inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                >
                  Upgrade to Pro
                </a>
              </div>
            ) : state.globalError ? (
              <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                <XCircle size={14} className="mt-0.5 shrink-0 text-error" />
                <p className="text-xs text-error/90">{state.globalError}</p>
              </div>
            ) : null}

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
          {state.job ? (
            <QuickJobCard
              job={state.job}
              sizeLabel={
                selectedSize
                  ? getSizeLabel(selectedSize, state.orientation)
                  : state.sizeId
              }
              onRetry={state.job.status === "error" ? exportSingle : undefined}
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-accent/10 p-1.5">
                  <FileImage size={16} className="text-accent-light" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-foreground">
                    Your export will appear here
                  </h3>
                  <p className="mt-0.5 text-xs leading-tight text-foreground/40">
                    Export one exact print size as a 300 DPI JPG.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      Single file, exact dimensions
                    </li>
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      300 DPI print-ready JPG
                    </li>
                    <li className="flex items-center gap-1.5 text-xs leading-tight text-foreground/25">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/20" />
                      Perfect for single-size listings
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

// ---------------------------------------------------------------------------
// Quick Job Card (inline, specific to this page)
// ---------------------------------------------------------------------------

function QuickJobCard({
  job,
  sizeLabel,
  onRetry,
}: {
  job: JobInfo;
  sizeLabel: string;
  onRetry?: () => void;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const showDebug =
    process.env.NODE_ENV !== "production" ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1");

  const config = {
    queued: {
      label: "Queued",
      color: "text-foreground/50",
      bg: "bg-foreground/5",
      border: "border-border",
      cardBorder: "border-border",
      icon: <Clock size={12} />,
    },
    running: {
      label: "Processing",
      color: "text-accent-light",
      bg: "bg-accent/10",
      border: "border-accent/30",
      cardBorder: "border-border",
      icon: <Loader size={12} className="animate-spin" />,
    },
    done: {
      label: "Ready",
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
      cardBorder: "border-success/20",
      icon: <CheckCircle2 size={12} />,
    },
    error: {
      label: "Failed",
      color: "text-error",
      bg: "bg-error/10",
      border: "border-error/30",
      cardBorder: "border-error/20",
      icon: <AlertCircle size={12} />,
    },
  }[job.status];

  return (
    <div
      className={`rounded-xl border bg-surface p-4 transition-colors ${config.cardBorder}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{sizeLabel}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.bg} ${config.border}`}
        >
          {config.icon}
          {config.label}
        </span>
      </div>

      {job.status === "done" && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-success/70">
            Your export is ready.
          </p>
          <a
            href={job.downloadUrl ?? `/api/download?job_id=${encodeURIComponent(job.jobId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success/15 px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/25"
          >
            <Download size={16} />
            Download JPG
          </a>
        </div>
      )}

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

      {showDebug && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            onClick={() => setDebugOpen(!debugOpen)}
            className="flex items-center gap-1 text-xs text-foreground/30 transition-colors hover:text-foreground/50"
          >
            {debugOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Debug
          </button>
          {debugOpen && (
            <div className="mt-2 rounded-md bg-background/50 p-2 font-mono text-xs text-foreground/30">
              <div>jobId: {job.jobId}</div>
              <div>status: {job.status}</div>
              {job.downloadUrl && <div>url: {job.downloadUrl}</div>}
              {job.error && <div>error: {job.error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

