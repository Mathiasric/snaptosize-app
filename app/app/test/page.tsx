"use client";

import { useState, useRef } from "react";

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [group, setGroup] = useState("etsy");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  function appendLog(line: string) {
    setLog((prev) => prev + `[${new Date().toLocaleTimeString()}] ${line}\n`);
  }

  async function run() {
    if (!file) return;
    setLog("");
    setRunning(true);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 1. Upload
      appendLog(`Uploading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
        signal: abort.signal,
      });
      if (!uploadRes.ok) {
        appendLog(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
        return;
      }
      const uploadData = await uploadRes.json();
      appendLog(`Upload OK: ${JSON.stringify(uploadData)}`);
      const imageKey = uploadData.image_key;
      if (!imageKey) {
        appendLog("No image_key in response. Aborting.");
        return;
      }

      // 2. Enqueue
      appendLog(`Enqueuing job: image_key=${imageKey}, group=${group}`);
      const enqueueRes = await fetch("/api/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_key: imageKey, group, demo: true }),
        signal: abort.signal,
      });
      if (!enqueueRes.ok) {
        appendLog(`Enqueue failed: ${enqueueRes.status} ${await enqueueRes.text()}`);
        return;
      }
      const enqueueData = await enqueueRes.json();
      appendLog(`Enqueue OK: ${JSON.stringify(enqueueData)}`);
      const jobId = enqueueData.job_id;
      if (!jobId) {
        appendLog("No job_id in response. Aborting.");
        return;
      }

      // 3. Poll status
      appendLog(`Polling status for job_id=${jobId}...`);
      let done = false;
      for (let i = 1; i <= 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (abort.signal.aborted) return;

        const statusRes = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, {
          signal: abort.signal,
        });
        if (!statusRes.ok) {
          appendLog(`Poll ${i}/60 — HTTP ${statusRes.status}`);
          continue;
        }
        const statusData = await statusRes.json();
        appendLog(`Poll ${i}/60 — ${JSON.stringify(statusData)}`);

        if (
          statusData.state === "done" ||
          statusData.status === "done" ||
          statusData.done === true
        ) {
          done = true;
          appendLog("Job complete!");
          break;
        }
      }

      if (!done) {
        appendLog("Timed out after 60 polls.");
        return;
      }

      // 4. Download
      appendLog("Starting download...");
      window.open(`/api/download?job_id=${encodeURIComponent(jobId)}`, "_blank");
      appendLog("Download triggered in new tab.");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        appendLog("Aborted.");
      } else {
        appendLog(`Error: ${err}`);
      }
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        E2E Test — Phase 1
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
        <label>
          <span style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Image</span>
          <input
            type="file"
            accept="image/*"
            disabled={running}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label>
          <span style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Group</span>
          <input
            type="text"
            value={group}
            disabled={running}
            onChange={(e) => setGroup(e.target.value)}
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ccc",
              borderRadius: 4,
              width: "100%",
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={run}
          disabled={running || !file}
          style={{
            padding: "0.5rem 1.25rem",
            background: running || !file ? "#999" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: running || !file ? "default" : "pointer",
          }}
        >
          {running ? "Running..." : "Run E2E"}
        </button>
        {running && (
          <button
            onClick={stop}
            style={{
              padding: "0.5rem 1.25rem",
              background: "#c00",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Abort
          </button>
        )}
      </div>

      <textarea
        readOnly
        value={log}
        rows={20}
        style={{
          width: "100%",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "0.8rem",
          padding: "0.75rem",
          background: "#111",
          color: "#0f0",
          border: "1px solid #333",
          borderRadius: 4,
          resize: "vertical",
        }}
      />
    </div>
  );
}
