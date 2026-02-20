import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function GET(req: Request) {
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) return new Response("Missing WORKER_BASE_URL", { status: 500 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");
  if (!jobId) return new Response("Missing job_id", { status: 400 });

  const r = await fetch(`${base}/status/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await r.text();

  return new Response(text, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}
