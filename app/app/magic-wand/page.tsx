"use client";

import React, { useState, useReducer, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { UploadZone } from "../components/UploadZone";
import { PackSelector, ALL_KEYS, PACKS } from "../components/PackSelector";
import type { Group } from "../components/PackSelector";
import { JobCard } from "../components/JobCard";
import type { Job, JobStatus } from "../components/JobCard";
import { GenerateButton } from "../components/GenerateButton";
import { Wand2, Download, Lock } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "uploading" | "polling" | "done" | "error";

type State = {
  phase: Phase;
  file: File | null;
  selected: Record<Group, boolean>;
  imageKey?: string;
  jobs: Partial<Record<Group, Job>>;
  globalError?: string;
  recentDownloads: { label: string; downloadUrl: string; jobId: string }[];
};

type Action =
  | { type: "set_file"; file: File | null }
  | { type: "toggle_group"; group: Group; value: boolean }
  | { type: "select_all"; value: boolean }
  | { type: "set_image_key"; imageKey: string }
  | { type: "set_phase"; phase: Phase }
  | { type: "set_job"; group: Group; job: Job }
  | { type: "set_global_error"; error: string }
  | { type: "add_download"; label: string; downloadUrl: string; jobId: string }
  | { type: "reset" };

function initialSelected(): Record<Group, boolean> {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, false])) as Record<Group, boolean>;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_file":
      return { ...state, file: action.file };
    case "toggle_group":
      return { ...state, selected: { ...state.selected, [action.group]: action.value } };
    case "select_all":
      return { ...state, selected: Object.fromEntries(ALL_KEYS.map((k) => [k, action.value])) as Record<Group, boolean> };
    case "set_image_key":
      return { ...state, imageKey: action.imageKey };
    case "set_phase":
      return { ...state, phase: action.phase };
    case "set_job":
      return { ...state, jobs: { ...state.jobs, [action.group]: action.job } };
    case "set_global_error":
      return { ...state, globalError: action.error, phase: "error" };
    case "add_download":
      return {
        ...state,
        recentDownloads: [
          { label: action.label, downloadUrl: action.downloadUrl, jobId: action.jobId },
          ...state.recentDownloads,
        ],
      };
    case "reset":
      return { ...state, jobs: {}, globalError: undefined, phase: "idle", imageKey: undefined, recentDownloads: [] };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDone(d: Record<string, unknown>) {
  return d.status === "done" || d.state === "done";
}
function isError(d: Record<string, unknown>) {
  return d.status === "error" || d.state === "error";
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return ""; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MagicWandPage() {
  const { user } = useUser();
  const posthog = usePostHog();
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === "pro";

  const [state, dispatch] = useReducer(reducer, {
    phase: "idle",
    file: null,
    selected: initialSelected(),
    jobs: {},
    recentDownloads: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const selectedGroups = ALL_KEYS.filter((k) => state.selected[k]);
  const isRunning = state.phase === "uploading" || state.phase === "polling";

  // Pro gate
  if (user && !isPro) {
    return (
      <div className="mx-auto max-w-[700px] px-4 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-accent/10 p-4">
            <Lock className="text-accent" size={28} />
          </span>
        </div>
        <h2 className="mb-2 text-xl font-semibold">Magic Wand is a Pro feature</h2>
        <p className="mb-6 text-sm text-foreground/60">
          Upgrade to Pro to access AI-powered ratio conversion — no stretch, no borders, just seamless fills.
        </p>
        <Link
          href="/app/billing"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  async function pollJob(group: Group, jobId: string, signal: AbortSignal): Promise<"done" | "error"> {
    const start = Date.now();
    let consecutiveFailures = 0;

    while (!signal.aborted) {
      if (Date.now() - start > 260_000) {
        dispatch({ type: "set_job", group, job: { group, jobId, status: "error", error: "Taking too long. Retry is safe." } });
        return "error";
      }
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { signal });
        if (res.ok) {
          consecutiveFailures = 0;
          const data = await res.json();
          if (isDone(data)) {
            dispatch({ type: "set_job", group, job: { group, jobId, status: "done" } });
            const pack = PACKS.find((p) => p.key === group);
            dispatch({
              type: "add_download",
              label: pack?.label ?? group,
              downloadUrl: `/api/download?job_id=${encodeURIComponent(jobId)}`,
              jobId,
            });
            posthog?.capture("magic_wand_export_completed", { pack_template: group, plan: "pro" });
            return "done";
          } else if (isError(data)) {
            dispatch({ type: "set_job", group, job: { group, jobId, status: "error", error: (data.error as string) || "Processing failed" } });
            return "error";
          } else {
            const s: JobStatus = data.status === "queued" || data.state === "queued" ? "queued" : "running";
            dispatch({ type: "set_job", group, job: { group, jobId, status: s } });
          }
        } else {
          if (++consecutiveFailures >= 10) {
            dispatch({ type: "set_job", group, job: { group, jobId, status: "error", error: `Server error (HTTP ${res.status})` } });
            return "error";
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (++consecutiveFailures >= 10) {
          dispatch({ type: "set_job", group, job: { group, jobId, status: "error", error: "Connection lost" } });
          return "error";
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return "error";
  }

  async function generate() {
    if (!state.file || selectedGroups.length === 0) return;

    dispatch({ type: "reset" });
    dispatch({ type: "set_file", file: state.file });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
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
        dispatch({ type: "set_global_error", error: "Upload returned no key." });
        return;
      }
      dispatch({ type: "set_image_key", imageKey });

      dispatch({ type: "set_phase", phase: "polling" });

      const artworkName = state.file.name.replace(/\.[^.]+$/, "");

      for (const group of selectedGroups) {
        dispatch({ type: "set_job", group, job: { group, status: "queued" } });

        const enqRes = await fetch("/api/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_key: imageKey, group, artwork_name: artworkName, smart_fill: true }),
          signal: ac.signal,
        });

        if (!enqRes.ok) {
          const body = await safeText(enqRes);
          dispatch({ type: "set_job", group, job: { group, status: "error", error: body || `HTTP ${enqRes.status}` } });
          continue;
        }

        const enqData = await enqRes.json();
        const jobId = enqData?.job_id as string | undefined;
        if (!jobId) {
          dispatch({ type: "set_job", group, job: { group, status: "error", error: "No job ID returned" } });
          continue;
        }

        dispatch({ type: "set_job", group, job: { group, jobId, status: "queued" } });
        await pollJob(group, jobId, ac.signal);
      }

      dispatch({ type: "set_phase", phase: "done" });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        dispatch({ type: "set_global_error", error: "Unexpected error. Please try again." });
      }
    }
  }

  const activeJobs = (Object.entries(state.jobs) as [Group, Job][]).filter(([, j]) => j);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-lg bg-accent/10 p-2">
          <Wand2 className="text-accent" size={20} />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Magic Wand</h1>
          <p className="text-sm text-foreground/50">AI fills ratio gaps seamlessly — no stretch, no black bars.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: upload + selector */}
        <div className="space-y-5">
          <UploadZone
            file={state.file}
            onFileChange={(f) => dispatch({ type: "set_file", file: f })}
            disabled={isRunning}
            isPro={isPro}
          />

          <PackSelector
            selected={state.selected}
            onToggle={(group, value) => dispatch({ type: "toggle_group", group, value })}
            onSelectAll={(value) => dispatch({ type: "select_all", value })}
            disabled={isRunning}
          />

          <p className="text-xs text-foreground/35 leading-relaxed">
            Your artwork is processed by our AI partner to fill ratio gaps. Files are not stored or used for training.
          </p>

          <GenerateButton
            disabled={!state.file || selectedGroups.length === 0 || isRunning}
            loading={isRunning}
            onClick={generate}
            label="Generate with Magic Wand"
            loadingLabel="Processing with AI..."
          />
        </div>

        {/* Right: job status + downloads */}
        <div className="space-y-3">
          {activeJobs.length > 0 && (
            <div className="space-y-2">
              {activeJobs.map(([group, job]) => (
                <JobCard key={group} group={group} job={job} />
              ))}
            </div>
          )}

          {state.recentDownloads.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-foreground/40 uppercase tracking-wide">Ready to download</p>
              {state.recentDownloads.map((d) => (
                <a
                  key={d.jobId}
                  href={d.downloadUrl}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface/80 transition-colors"
                >
                  <Download size={14} className="text-accent shrink-0" />
                  <span className="truncate">{d.label}</span>
                </a>
              ))}
            </div>
          )}

          {state.globalError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {state.globalError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
