"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { FolderHeart, Plus, Download, Lock } from "lucide-react";
import Link from "next/link";
import { UploadZone } from "../components/UploadZone";
import { GenerateButton } from "../components/GenerateButton";
import { SavedPackCard } from "./_components/SavedPackCard";
import { PackBuilderModal } from "./_components/PackBuilderModal";
import type { CustomPack } from "./_components/types";

type Phase = "idle" | "uploading" | "polling" | "done" | "error";

interface JobState {
  jobId?: string;
  status: "queued" | "running" | "done" | "error";
  error?: string;
}

export default function MyPacksPage() {
  const { user } = useUser();
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === "pro";

  const [packs, setPacks] = useState<CustomPack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPack, setEditingPack] = useState<CustomPack | undefined>(undefined);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<JobState | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [globalError, setGlobalError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const isRunning = phase === "uploading" || phase === "polling";
  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? null;

  useEffect(() => {
    if (!isPro) return;
    fetchPacks();
  }, [isPro]);

  async function fetchPacks() {
    setLoadingPacks(true);
    try {
      const r = await fetch("/api/custom-packs");
      if (r.ok) {
        const data = await r.json();
        const sorted = (data.packs as CustomPack[]).sort((a, b) => a.createdAt - b.createdAt);
        setPacks(sorted);
        if (sorted.length > 0 && !selectedPackId) setSelectedPackId(sorted[0].id);
      }
    } finally {
      setLoadingPacks(false);
    }
  }

  async function savePack(name: string, sizes: string[], id?: string) {
    const r = await fetch("/api/custom-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, sizes }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    const data = await r.json();
    const saved: CustomPack = data.pack;
    setPacks((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) return prev.map((p) => (p.id === saved.id ? saved : p));
      return [...prev, saved];
    });
    setSelectedPackId(saved.id);
  }

  async function deletePack(packId: string) {
    const r = await fetch(`/api/custom-packs/${packId}`, { method: "DELETE" });
    if (!r.ok) return;
    setPacks((prev) => prev.filter((p) => p.id !== packId));
    setSelectedPackId((prev) => {
      if (prev !== packId) return prev;
      const remaining = packs.filter((p) => p.id !== packId);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }

  function openCreate() { setEditingPack(undefined); setShowModal(true); }
  function openEdit(pack: CustomPack) { setEditingPack(pack); setShowModal(true); }

  async function pollJob(jobId: string, signal: AbortSignal): Promise<"done" | "error"> {
    const start = Date.now();
    let failures = 0;
    while (!signal.aborted) {
      if (Date.now() - start > 260_000) {
        setJob({ jobId, status: "error", error: "Tok for lang tid. Prøv igjen." });
        return "error";
      }
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { signal });
        if (res.ok) {
          failures = 0;
          const data = await res.json();
          const s = data.status ?? data.state;
          if (s === "done") {
            setJob({ jobId, status: "done" });
            setDownloadUrl(`/api/download?job_id=${encodeURIComponent(jobId)}`);
            setDownloadName(data.download_filename ?? "my_pack.zip");
            return "done";
          } else if (s === "error") {
            setJob({ jobId, status: "error", error: data.error || "Prosessering feilet" });
            return "error";
          } else {
            setJob({ jobId, status: s === "queued" ? "queued" : "running" });
          }
        } else if (++failures >= 10) {
          setJob({ jobId, status: "error", error: `Serverfeil (HTTP ${res.status})` });
          return "error";
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (++failures >= 10) {
          setJob({ jobId, status: "error", error: "Tilkobling mistet" });
          return "error";
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return "error";
  }

  async function exportPack() {
    if (!file || !selectedPack) return;

    setPhase("uploading");
    setJob(null);
    setDownloadUrl(null);
    setGlobalError("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
        signal: ac.signal,
      });
      if (!uploadRes.ok) { setGlobalError("Opplasting feilet. Prøv igjen."); setPhase("error"); return; }

      const { image_key } = await uploadRes.json();
      if (!image_key) { setGlobalError("Ingen image_key fra opplasting."); setPhase("error"); return; }

      setPhase("polling");
      setJob({ status: "queued" });

      const artworkName = file.name.replace(/\.[^.]+$/, "");
      const enqRes = await fetch("/api/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_key,
          artwork_name: artworkName,
          custom_sizes: selectedPack.sizes,
          pack_name: selectedPack.name,
        }),
        signal: ac.signal,
      });

      if (!enqRes.ok) {
        const body = await enqRes.text().catch(() => "");
        setGlobalError(body || `HTTP ${enqRes.status}`);
        setPhase("error");
        return;
      }

      const { job_id } = await enqRes.json();
      if (!job_id) { setGlobalError("Ingen jobb-ID returnert"); setPhase("error"); return; }

      setJob({ jobId: job_id, status: "queued" });
      await pollJob(job_id, ac.signal);
      setPhase("done");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setGlobalError("Uventet feil. Prøv igjen.");
        setPhase("error");
      }
    }
  }

  if (user && !isPro) {
    return (
      <div className="mx-auto max-w-[700px] px-4 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-accent/10 p-4">
            <Lock className="text-accent" size={28} />
          </span>
        </div>
        <h2 className="mb-2 text-xl font-semibold">My Packs er en Pro-funksjon</h2>
        <p className="mb-6 text-sm text-foreground/60">
          Lagre dine egne størrelseskombinasjoner og eksporter med ett klikk — hver gang.
        </p>
        <Link
          href="/app/billing"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Oppgrader til Pro
        </Link>
      </div>
    );
  }

  const jobStatusLabel = job
    ? job.status === "queued" ? "I kø..."
    : job.status === "running" ? "Prosesserer..."
    : job.status === "done" ? "Ferdig"
    : "Feil"
    : null;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-lg bg-accent/10 p-2">
          <FolderHeart className="text-accent" size={20} />
        </span>
        <div>
          <h1 className="text-lg font-semibold">My Packs</h1>
          <p className="text-sm text-foreground/50">Lagre egne størrelsessett og eksporter med ett klikk.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Dine pakker
            </span>
            {packs.length < 10 && (
              <button
                onClick={openCreate}
                disabled={isRunning}
                className="flex items-center gap-1 text-xs text-foreground/40 transition-colors hover:text-accent disabled:opacity-30"
              >
                <Plus size={12} />
                Ny pakke
              </button>
            )}
          </div>

          {loadingPacks ? (
            <p className="text-xs text-foreground/30">Laster...</p>
          ) : packs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <p className="mb-3 text-xs text-foreground/40">Ingen pakker ennå.</p>
              <button
                onClick={openCreate}
                className="text-xs font-medium text-accent hover:opacity-80"
              >
                + Opprett første pakke
              </button>
            </div>
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
              {packs.length >= 10 && (
                <p className="text-xs text-foreground/30">Maks 10 pakker nådd.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {!selectedPack && packs.length > 0 && (
            <p className="text-sm text-foreground/50">Velg en pakke til venstre for å eksportere.</p>
          )}

          {(selectedPack || packs.length === 0) && (
            <>
              <UploadZone
                file={file}
                onFileChange={setFile}
                disabled={isRunning}
                isPro={isPro}
              />

              {selectedPack && (
                <div className="rounded-xl border border-border bg-surface/40 px-4 py-3">
                  <p className="text-xs text-foreground/40 mb-1">Eksporterer med</p>
                  <p className="text-sm font-medium">{selectedPack.name}</p>
                  <p className="text-xs text-foreground/35 mt-0.5">{selectedPack.sizes.join(", ")}</p>
                </div>
              )}

              <GenerateButton
                disabled={!file || !selectedPack || isRunning}
                loading={isRunning}
                onClick={exportPack}
                label="Eksporter pakke"
                loadingLabel="Prosesserer..."
              />

              {job && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${
                  job.status === "error"
                    ? "border-red-500/20 bg-red-500/5 text-red-400"
                    : job.status === "done"
                    ? "border-green-500/20 bg-green-500/5 text-green-400"
                    : "border-border bg-surface/40 text-foreground/60"
                }`}>
                  {job.status === "error" ? job.error : jobStatusLabel}
                </div>
              )}

              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={downloadName}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium transition-colors hover:bg-surface/80"
                >
                  <Download size={14} className="text-accent shrink-0" />
                  <span className="truncate">{downloadName || selectedPack?.name}</span>
                </a>
              )}

              {globalError && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  {globalError}
                </p>
              )}

              <p className="text-xs text-foreground/35 leading-relaxed">
                Filene dine behandles sikkert og slettes automatisk etter 7 dager.
              </p>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <PackBuilderModal
          initial={editingPack}
          onSave={savePack}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
