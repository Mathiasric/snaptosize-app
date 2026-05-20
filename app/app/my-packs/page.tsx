"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import {
  Plus,
  Download,
  Lock,
  Sparkles,
  TrendingUp,
  Square as SquareIcon,
  RectangleHorizontal,
  Layers,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { UploadZone } from "../components/UploadZone";
import { GenerateButton } from "../components/GenerateButton";
import { SavedPackCard } from "./_components/SavedPackCard";
import { PackBuilderModal } from "./_components/PackBuilderModal";
import { MyPacksPreviewPanel } from "./_components/MyPacksPreviewPanel";
import type { CustomPack } from "./_components/types";
import { MAX_PACKS_PER_USER, deriveOrientationFromSizes } from "./_components/types";
import { TEMPLATES, type PackTemplate } from "./_components/templates";
import type { Orientation } from "../lib/size-catalog";

type Phase = "idle" | "uploading" | "polling" | "done" | "error";

interface JobState {
  jobId?: string;
  status: "queued" | "running" | "done" | "error";
  error?: string;
}

export default function MyPacksPage() {
  const { user } = useUser();
  const posthog = usePostHog();
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === "pro";

  const [packs, setPacks] = useState<CustomPack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingPack, setEditingPack] = useState<CustomPack | undefined>(undefined);

  const [file, setFile] = useState<File | null>(null);
  const [imageOrientation, setImageOrientation] = useState<Orientation | null>(null);
  const [dismissedOrientationWarning, setDismissedOrientationWarning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<JobState | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [globalError, setGlobalError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const isRunning = phase === "uploading" || phase === "polling";
  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? null;

  // Progressive disclosure: hide hero + trust footer after first successful export
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setIntroSeen(localStorage.getItem("my_packs_intro_seen") === "1");
    } catch {
      setIntroSeen(false);
    }
  }, []);
  useEffect(() => {
    if (phase === "done" && job?.status === "done" && introSeen === false) {
      try {
        localStorage.setItem("my_packs_intro_seen", "1");
      } catch {
        /* ignore */
      }
      setIntroSeen(true);
    }
  }, [phase, job?.status, introSeen]);
  const showIntro = introSeen !== true;

  // Reset export state when switching packs so the preview panel returns
  // (pack switching is disabled while a job runs, so this never fires mid-export).
  useEffect(() => {
    setJob(null);
    setDownloadUrl(null);
    setPhase("idle");
  }, [selectedPackId]);

  useEffect(() => {
    if (!isPro) return;
    fetchPacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  // Detect orientation of uploaded image
  useEffect(() => {
    setDismissedOrientationWarning(false);
    if (!file) {
      setImageOrientation(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 1) < 0.05) setImageOrientation("Square");
      else if (ratio > 1) setImageOrientation("Landscape");
      else setImageOrientation("Portrait");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setImageOrientation(null);
    };
    img.src = url;
  }, [file]);

  async function fetchPacks() {
    setLoadingPacks(true);
    try {
      const r = await fetch("/api/custom-packs");
      if (r.ok) {
        const data = await r.json();
        const sorted = (data.packs as CustomPack[])
          .map((p) => {
            // If Worker didn't persist orientation, derive it client-side.
            // Square sizes (W=H) → Square; otherwise default Portrait.
            const stored = p.orientation;
            const derived = deriveOrientationFromSizes(p.sizes);
            const orientation: Orientation = stored ?? derived ?? "Portrait";
            return { ...p, orientation };
          })
          .sort((a, b) => a.createdAt - b.createdAt);
        setPacks(sorted);
        if (sorted.length > 0 && !selectedPackId) setSelectedPackId(sorted[0].id);
      }
    } finally {
      setLoadingPacks(false);
    }
  }

  async function savePack(name: string, sizes: string[], orientation: Orientation, id?: string) {
    const r = await fetch("/api/custom-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, sizes, orientation }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    const data = await r.json();
    const saved: CustomPack = { ...data.pack, orientation: data.pack.orientation ?? orientation };
    posthog?.capture("custom_pack_created", {
      pack_id: saved.id,
      size_count: sizes.length,
      orientation,
      from_template: false,
    });
    setPacks((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) return prev.map((p) => (p.id === saved.id ? saved : p));
      return [...prev, saved];
    });
    setSelectedPackId(saved.id);
  }

  async function addTemplate(template: PackTemplate) {
    if (packs.length >= MAX_PACKS_PER_USER) return;
    // Avoid duplicate names — append " (copy)" if name exists
    let name = template.name;
    const existing = new Set(packs.map((p) => p.name));
    if (existing.has(name)) {
      let i = 2;
      while (existing.has(`${name} ${i}`)) i++;
      name = `${name} ${i}`;
    }
    try {
      await savePack(name, template.sizes, template.orientation);
      posthog?.capture("custom_pack_template_added", { template_id: template.id });
      setShowTemplates(false);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Could not add template");
    }
  }

  async function deletePack(packId: string) {
    console.log("[my-packs] deletePack START", { packId });
    try {
      const r = await fetch(`/api/custom-packs?id=${encodeURIComponent(packId)}`, { method: "DELETE" });
      console.log("[my-packs] delete response", { status: r.status, ok: r.ok });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        setGlobalError(`Could not delete pack (HTTP ${r.status}): ${body.slice(0, 200)}`);
        console.error("[my-packs] Delete failed", { status: r.status, body, packId });
        return;
      }
      posthog?.capture("custom_pack_deleted", { pack_id: packId });
      setPacks((prev) => prev.filter((p) => p.id !== packId));
      setSelectedPackId((prev) => {
        if (prev !== packId) return prev;
        const remaining = packs.filter((p) => p.id !== packId);
        return remaining.length > 0 ? remaining[0].id : null;
      });
      setGlobalError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGlobalError(`Delete error: ${msg}`);
      console.error("[my-packs] Delete exception", err);
    }
  }

  function openCreate() {
    setEditingPack(undefined);
    setShowModal(true);
  }
  function openEdit(pack: CustomPack) {
    setEditingPack(pack);
    setShowModal(true);
  }

  async function pollJob(jobId: string, signal: AbortSignal): Promise<"done" | "error"> {
    const start = Date.now();
    let failures = 0;
    let pollCount = 0;
    while (!signal.aborted) {
      pollCount++;
      if (Date.now() - start > 260_000) {
        setJob({ jobId, status: "error", error: "Took too long. Please try again." });
        return "error";
      }
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { signal });
        if (res.ok) {
          failures = 0;
          const data = await res.json();
          if (pollCount <= 3 || data.status === "error" || data.status === "done") {
            console.log(`[my-packs] pollJob #${pollCount}`, data);
          }
          const s = data.status ?? data.state;
          if (s === "done") {
            setJob({ jobId, status: "done" });
            setDownloadUrl(`/api/download?job_id=${encodeURIComponent(jobId)}`);
            setDownloadName(data.download_filename ?? "my_pack.zip");
            posthog?.capture("custom_pack_exported", {
              pack_id: selectedPackId,
              pack_name: selectedPack?.name,
              orientation: selectedPack?.orientation,
              size_count: selectedPack?.sizes.length,
            });
            return "done";
          } else if (s === "error") {
            // Worker stores error_message + error_code; older code may use error.
            const errMsg =
              data.error_message ||
              data.error ||
              (data.error_code ? `Worker error: ${data.error_code}` : null) ||
              "Processing failed";
            console.error("[my-packs] Worker job failed", { error_code: data.error_code, error_message: data.error_message, error: data.error, runner_status: data.runner_status, fullData: data });
            posthog?.capture("custom_pack_job_failed", {
              error_code: data.error_code,
              error_message: data.error_message,
              pack_orientation: selectedPack?.orientation,
              size_count: selectedPack?.sizes.length,
            });
            setJob({ jobId, status: "error", error: errMsg });
            return "error";
          } else {
            setJob({ jobId, status: s === "queued" ? "queued" : "running" });
          }
        } else if (++failures >= 10) {
          setJob({ jobId, status: "error", error: `Server error (HTTP ${res.status})` });
          return "error";
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (++failures >= 10) {
          setJob({ jobId, status: "error", error: "Connection lost" });
          return "error";
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return "error";
  }

  async function exportPack() {
    if (!file || !selectedPack) return;

    console.log("[my-packs] exportPack START", { pack: selectedPack.name, sizes: selectedPack.sizes, orientation: selectedPack.orientation, fileSize: file.size });
    posthog?.capture("custom_pack_export_started", {
      pack_id: selectedPack.id,
      pack_name: selectedPack.name,
      orientation: selectedPack.orientation,
      size_count: selectedPack.sizes.length,
      file_size_kb: Math.round(file.size / 1024),
    });

    setPhase("uploading");
    setJob(null);
    setDownloadUrl(null);
    setGlobalError("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      console.log("[my-packs] uploading file to /api/upload");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
        signal: ac.signal,
      });
      console.log("[my-packs] upload response", { status: uploadRes.status, ok: uploadRes.ok });
      if (!uploadRes.ok) {
        const body = await uploadRes.text().catch(() => "");
        setGlobalError(`Upload failed (HTTP ${uploadRes.status}): ${body.slice(0, 200)}`);
        console.error("[my-packs] Upload failed", { status: uploadRes.status, body });
        setPhase("error");
        return;
      }

      const uploadJson = await uploadRes.json();
      console.log("[my-packs] upload json", uploadJson);
      const { image_key } = uploadJson;
      if (!image_key) {
        setGlobalError(`No image_key in upload response: ${JSON.stringify(uploadJson)}`);
        setPhase("error");
        return;
      }

      setPhase("polling");
      setJob({ status: "queued" });

      const artworkName = file.name.replace(/\.[^.]+$/, "");
      const enqueuePayload: Record<string, unknown> = {
        image_key,
        artwork_name: artworkName,
        custom_sizes: selectedPack.sizes,
        pack_name: selectedPack.name,
      };
      enqueuePayload.orientation = selectedPack.orientation;
      console.log("[my-packs] enqueue payload", enqueuePayload);
      const enqRes = await fetch("/api/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enqueuePayload),
        signal: ac.signal,
      });
      console.log("[my-packs] enqueue response", { status: enqRes.status, ok: enqRes.ok });

      if (!enqRes.ok) {
        const body = await enqRes.text().catch(() => "");
        setGlobalError(friendlyEnqueueError(enqRes.status, body));
        console.error("[my-packs] Enqueue failed", { status: enqRes.status, body, payload: enqueuePayload });
        posthog?.capture("custom_pack_export_failed", {
          status: enqRes.status,
          stage: "enqueue",
          pack_id: selectedPack.id,
          orientation: selectedPack.orientation,
        });
        setPhase("error");
        return;
      }

      const enqJson = await enqRes.json();
      console.log("[my-packs] enqueue json", enqJson);
      const { job_id } = enqJson;
      if (!job_id) {
        setGlobalError(`No job_id in enqueue response: ${JSON.stringify(enqJson)}`);
        setPhase("error");
        return;
      }

      setJob({ jobId: job_id, status: "queued" });
      console.log("[my-packs] starting pollJob for", job_id);
      const result = await pollJob(job_id, ac.signal);
      console.log("[my-packs] pollJob finished with", result);
      setPhase(result === "done" ? "done" : "error");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        const msg = err instanceof Error ? err.message : String(err);
        setGlobalError(`Export error: ${msg}`);
        console.error("[my-packs] Export exception", err);
        setPhase("error");
      }
    }
  }

  // ───── Pro-gate (free users)
  if (user && !isPro) {
    return <ProGate />;
  }

  const jobStatusLabel = job
    ? job.status === "queued"
      ? "Queued..."
      : job.status === "running"
      ? "Processing..."
      : job.status === "done"
      ? "Done"
      : "Error"
    : null;

  const orientationMismatch =
    selectedPack &&
    imageOrientation &&
    selectedPack.orientation !== imageOrientation &&
    !(selectedPack.orientation === "Square" && imageOrientation === "Square");

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8">
      {/* Page hero — anchors first visit, hides after first successful export */}
      {showIntro && (
        <header className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            My packs
          </h1>
          <p className="mt-1 max-w-[640px] text-sm text-foreground/55">
            Saved size sets — one click to export your artwork as a print-ready ZIP.
          </p>
        </header>
      )}

      {/* Empty state */}
      {!loadingPacks && packs.length === 0 ? (
        <EmptyStateTemplates onPickTemplate={addTemplate} onBuildCustom={openCreate} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,580px)]">
          {/* Left: saved packs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground/75">
                Your packs
              </span>
              {packs.length < MAX_PACKS_PER_USER && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTemplates(true)}
                    disabled={isRunning}
                    className="flex items-center gap-1 rounded text-xs text-foreground/40 transition-colors hover:text-accent disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Sparkles size={12} />
                    Templates
                  </button>
                  <span className="text-foreground/20">·</span>
                  <button
                    onClick={openCreate}
                    disabled={isRunning}
                    className="flex items-center gap-1 rounded text-xs text-foreground/40 transition-colors hover:text-accent disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Plus size={12} />
                    New
                  </button>
                </div>
              )}
            </div>

            {loadingPacks ? (
              <PackListSkeleton />
            ) : (
              <div className="space-y-2">
                {packs.map((pack) => (
                  <SavedPackCard
                    key={pack.id}
                    pack={pack}
                    selected={selectedPackId === pack.id}
                    onSelect={() => setSelectedPackId(pack.id)}
                    onEdit={() => openEdit(pack)}
                    onDelete={() => deletePack(pack.id)}
                    disabled={isRunning}
                  />
                ))}
                {packs.length >= MAX_PACKS_PER_USER && (
                  <p className="text-xs text-foreground/30">
                    Maximum of {MAX_PACKS_PER_USER} packs reached.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: export */}
          <div className="space-y-5">
            {!selectedPack && packs.length > 0 && (
              <p className="text-sm text-foreground/50">
                Select a pack on the left to start exporting.
              </p>
            )}

            {selectedPack && (
              <>
                <UploadZone file={file} onFileChange={setFile} disabled={isRunning} isPro={isPro} compact />

                {/* Orientation mismatch tip */}
                {orientationMismatch && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs">
                    <p className="font-semibold text-red-300">
                      Orientation mismatch — export blocked
                    </p>
                    <p className="mt-1 text-red-200/85">
                      This pack creates {selectedPack.orientation.toLowerCase()} prints, but your
                      image is {imageOrientation?.toLowerCase()}. Exporting would stretch the
                      artwork and produce poor results. Upload a {selectedPack.orientation.toLowerCase()}{" "}
                      image, or pick a {imageOrientation?.toLowerCase()} pack from your library.
                    </p>
                  </div>
                )}

                {!job && (
                  <MyPacksPreviewPanel
                    file={file}
                    pack={selectedPack}
                    labelForSize={labelForSize}
                  />
                )}

                <GenerateButton
                  disabled={!file || isRunning || !!orientationMismatch}
                  loading={isRunning}
                  onClick={exportPack}
                  label="Export pack"
                  loadingLabel="Processing..."
                />

                {/* In-progress / error status (done collapses into the success card below) */}
                {job && job.status !== "done" && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      job.status === "error"
                        ? "border-red-500/20 bg-red-500/5 text-red-400"
                        : job.status === "running"
                        ? "border-accent/30 bg-accent/10 text-accent-light"
                        : "border-border bg-surface/40 text-foreground/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {job.status === "running" && (
                        <Loader size={12} className="shrink-0 animate-spin" />
                      )}
                      <span>{job.status === "error" ? job.error : jobStatusLabel}</span>
                    </div>
                    {job.status === "running" && (
                      <div className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-accent/10">
                        <div className="animate-shimmer-sweep absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
                      </div>
                    )}
                  </div>
                )}

                {/* Success card — merges done-status + download into one element */}
                {job?.status === "done" && downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={downloadName}
                    className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 px-4 py-3 transition-colors hover:bg-success/10"
                  >
                    <CheckCircle2 size={16} className="shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-success">Pack ready</p>
                      <p className="truncate text-xs text-foreground/50">
                        {downloadName || selectedPack.name}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">
                      <Download size={14} />
                      Download
                    </span>
                  </a>
                )}

                {globalError && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                    {globalError}
                  </p>
                )}

              </>
            )}
          </div>
        </div>
      )}

      {/* Post-grid trust footer — first-visit only; hides after first export */}
      {showIntro && (
        <div className="mt-10 border-t border-border/60 pt-6">
          <div className="grid gap-4 text-xs text-foreground/55 sm:grid-cols-3">
            <div>
              <p className="font-medium text-foreground/80">High resolution</p>
              <p className="mt-1 leading-relaxed text-foreground/45">
                Every file rendered at 300 DPI — gallery-grade for print-on-demand and home printers alike.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground/80">Privacy by default</p>
              <p className="mt-1 leading-relaxed text-foreground/45">
                Your artwork and ZIPs auto-delete after 7 days. We never share, sell, or train models on uploads.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground/80">One-click export</p>
              <p className="mt-1 leading-relaxed text-foreground/45">
                Saved size sets stay ready in your library — pick a pack, drop in a new artwork, get a ZIP.
              </p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <PackBuilderModal
          initial={editingPack}
          onSave={savePack}
          onClose={() => setShowModal(false)}
        />
      )}

      {showTemplates && (
        <TemplatesModal
          onPick={addTemplate}
          onClose={() => setShowTemplates(false)}
          disabledIds={new Set(packs.map((p) => p.name))}
          atLimit={packs.length >= MAX_PACKS_PER_USER}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyStateTemplates({
  onPickTemplate,
  onBuildCustom,
}: {
  onPickTemplate: (t: PackTemplate) => void;
  onBuildCustom: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Start with a recommended template</h2>
        <p className="mt-1 text-xs text-foreground/50">
          Curated from top-selling Etsy print sizes. One click and you&apos;re ready to export.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} onClick={() => onPickTemplate(t)} />
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-center">
        <p className="text-xs text-foreground/50">
          Need a different size mix?{" "}
          <button onClick={onBuildCustom} className="font-medium text-accent hover:opacity-80">
            Build a custom pack →
          </button>
        </p>
      </div>
    </div>
  );
}

function TemplateCard({ template, onClick }: { template: PackTemplate; onClick: () => void }) {
  const Icon = iconForTemplate(template.id);
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-border bg-surface/40 p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-accent/10 p-1.5">
          <Icon className="text-accent" size={14} />
        </span>
        <span className="rounded-md border border-border bg-background/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground/40">
          {template.orientation}
        </span>
      </div>
      <TemplateRatioPreview template={template} />
      <p className="text-sm font-medium">{template.name}</p>
      <p className="mt-1 text-xs text-foreground/45 leading-snug">{template.description}</p>
      <p className="mt-2 text-[11px] text-foreground/35">{template.sizes.map((s) => labelForSize(s, template.orientation)).join(" · ")}</p>
      <p className="mt-3 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
        + Add to My Packs
      </p>
    </button>
  );
}

function PackListSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading your packs">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative w-full rounded-xl border border-border bg-background/30 p-3"
        >
          <div className="pr-12">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-32 animate-pulse rounded bg-foreground/10" />
              <div className="h-5 w-5 animate-pulse rounded bg-foreground/8" />
            </div>
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-foreground/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function friendlyEnqueueError(status: number, body: string): string {
  let parsed: { error?: string; error_code?: string } | null = null;
  try { parsed = JSON.parse(body); } catch { /* not JSON */ }
  const code = parsed?.error_code;
  const msg = parsed?.error;
  if (status === 401 || status === 403) return "You need an active Pro plan to export custom packs.";
  if (status === 429) return "Too many exports running — try again in a moment.";
  if (status === 413 || (msg && /too large/i.test(msg))) {
    return "This pack would create a ZIP larger than Etsy's 20 MB limit. Remove a size or pick smaller dimensions.";
  }
  if (code === "bad_request" && msg && /pack mode/i.test(msg)) {
    return msg; // e.g. "Sizes too large for pack mode: ['24x36']..."
  }
  if (status >= 500) return "Our resizer hit a hiccup. Try again — the team has been notified.";
  if (msg) return msg;
  return `Export failed (HTTP ${status}). Try again or contact support.`;
}

function labelForSize(sizeId: string, orientation: Orientation): string {
  if (orientation !== "Landscape") return sizeId;
  if (sizeId.startsWith("A")) return sizeId;
  const parts = sizeId.split("x");
  if (parts.length === 2) return `${parts[1]}x${parts[0]}`;
  return sizeId;
}

const ISO_RATIOS: Record<string, [number, number]> = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

function sizeAspectRatio(sizeId: string, orientation: Orientation): { w: number; h: number } {
  let w = 1;
  let h = 1;
  const iso = ISO_RATIOS[sizeId];
  if (iso) {
    [w, h] = iso;
  } else {
    const parts = sizeId.split("x").map(parseFloat);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      [w, h] = parts;
    }
  }
  if (orientation === "Landscape") [w, h] = [Math.max(w, h), Math.min(w, h)];
  const max = Math.max(w, h);
  return { w: w / max, h: h / max };
}

function TemplateRatioPreview({ template }: { template: PackTemplate }) {
  const ratios = template.sizes.slice(0, 3).map((s) => sizeAspectRatio(s, template.orientation));
  const baseSize = 30; // px — longest side of the largest preview
  return (
    <div className="mb-3 flex h-9 items-end gap-1.5" aria-hidden>
      {ratios.map((r, i) => (
        <div
          key={i}
          className="rounded-[3px] border border-foreground/15 bg-foreground/5 transition-colors group-hover:border-accent/30 group-hover:bg-accent/5"
          style={{ width: `${r.w * baseSize}px`, height: `${r.h * baseSize}px` }}
        />
      ))}
    </div>
  );
}

function iconForTemplate(id: string) {
  switch (id) {
    case "etsy-bestsellers":
      return TrendingUp;
    case "square-print-set":
      return SquareIcon;
    case "landscape-print-set":
      return RectangleHorizontal;
    default:
      return Layers;
  }
}

// ─────────────────────────────────────────────────────────────
// Templates modal (post-empty)
// ─────────────────────────────────────────────────────────────

function TemplatesModal({
  onPick,
  onClose,
  disabledIds,
  atLimit,
}: {
  onPick: (t: PackTemplate) => void;
  onClose: () => void;
  disabledIds: Set<string>;
  atLimit: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Templates</h2>
            <p className="mt-0.5 text-xs text-foreground/50">
              Add curated size sets to your packs with one click.
            </p>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground/70">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {atLimit && (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              You&apos;ve reached the maximum of {MAX_PACKS_PER_USER} packs. Delete one to add a template.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const alreadyAdded = disabledIds.has(t.name);
              const Icon = iconForTemplate(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => !atLimit && onPick(t)}
                  disabled={atLimit}
                  className="group rounded-xl border border-border bg-surface/40 p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-md bg-accent/10 p-1.5">
                      <Icon className="text-accent" size={14} />
                    </span>
                    <span className="rounded-md border border-border bg-background/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground/40">
                      {t.orientation}
                    </span>
                  </div>
                  <TemplateRatioPreview template={t} />
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="mt-1 text-xs text-foreground/45 leading-snug">{t.description}</p>
                  <p className="mt-2 text-[11px] text-foreground/35 tabular-nums">{t.sizes.map((s) => labelForSize(s, t.orientation)).join(" · ")}</p>
                  {alreadyAdded && (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-foreground/40">
                      <CheckCircle2 size={10} /> Already added — adds a copy
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pro-gate (free users)
// ─────────────────────────────────────────────────────────────

function ProGate() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-12">
      <div className="rounded-2xl border border-border bg-surface/40 p-8 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-lg bg-accent/10 p-2.5">
            <Lock className="text-accent" size={18} />
          </span>
          <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
            Pro feature
          </span>
        </div>

        <h2 className="mb-3 text-2xl font-semibold tracking-tight">
          Save hours every week — forever.
        </h2>
        <p className="mb-7 max-w-[520px] text-sm text-foreground/60 leading-relaxed">
          My Packs lets you save your custom size combinations and export with one click — every
          time. Built for Etsy sellers who export the same sizes every week.
        </p>

        <ul className="mb-8 space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="font-medium">Curated Etsy-bestseller templates</strong> — top
              US/EU sizes ready in one click
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="font-medium">Cross-ratio packs</strong> — combine sizes across
              ratios (regular Packs mode can&apos;t do this)
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="font-medium">Unlimited exports</strong>, no watermarks, 7
              concurrent jobs
            </span>
          </li>
        </ul>

        <div className="mb-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium text-accent">
                Yearly
              </span>
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                Save 32%
              </span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              $97<span className="text-sm font-normal text-foreground/40">/year</span>
            </p>
            <p className="mt-0.5 text-xs text-foreground/45 tabular-nums">$8.08/month, billed annually</p>
          </div>
          <div className="rounded-xl border border-border bg-background/30 p-4">
            <span className="text-sm font-medium text-foreground/70">
              Monthly
            </span>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              $11.99<span className="text-sm font-normal text-foreground/40">/month</span>
            </p>
            <p className="mt-0.5 text-xs text-foreground/45">Cancel any time</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/app/billing"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Sparkles size={14} />
            Upgrade to Pro
          </Link>
          <Link
            href="/app/packs"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm text-foreground/50 transition-colors hover:text-foreground/80 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Use free Packs mode instead
          </Link>
        </div>
      </div>
    </div>
  );
}
