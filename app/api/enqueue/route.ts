import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const payload = await req.json();

  const start = Date.now();
  try {
    const r = await fetch(`${base}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const ms = Date.now() - start;
    const workerRequestId = r.headers.get("x-request-id") || requestId;
    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: workerRequestId, endpoint: "/api/enqueue", worker_path: "/enqueue", status: r.status, ms, user_id: userId || undefined, job_id: payload.job_id || undefined }));

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "x-request-id": workerRequestId,
      },
    });
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: requestId, endpoint: "/api/enqueue", worker_path: "/enqueue", status: 502, ms, user_id: userId || undefined, error: msg }));
    return Response.json({ error: "Enqueue proxy failed", detail: msg }, { status: 502, headers: { "x-request-id": requestId } });
  }
}
