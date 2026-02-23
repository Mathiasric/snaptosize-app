import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function GET(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");
  if (!jobId) return Response.json({ error: "Missing job_id" }, { status: 400, headers: { "x-request-id": requestId } });

  const start = Date.now();
  try {
    const r = await fetch(`${base}/download/${encodeURIComponent(jobId)}`, {
      headers: {
        "x-request-id": requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const ms = Date.now() - start;
    const workerRequestId = r.headers.get("x-request-id") || requestId;
    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: workerRequestId, endpoint: "/api/download", worker_path: `/download/${jobId}`, status: r.status, ms, user_id: userId || undefined, job_id: jobId }));

    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/zip",
        "Content-Disposition": r.headers.get("content-disposition") || `attachment; filename="${jobId}.zip"`,
        "x-request-id": workerRequestId,
      },
    });
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: requestId, endpoint: "/api/download", worker_path: `/download/${jobId}`, status: 502, ms, user_id: userId || undefined, job_id: jobId, error: msg }));
    return Response.json({ error: "Download proxy failed", detail: msg }, { status: 502, headers: { "x-request-id": requestId } });
  }
}
