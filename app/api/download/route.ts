import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function GET(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");
  if (!jobId) return Response.json({ error: "Missing job_id" }, { status: 400 });

  try {
    const r = await fetch(`${base}/download/${encodeURIComponent(jobId)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/zip",
        "Content-Disposition": r.headers.get("content-disposition") || `attachment; filename="${jobId}.zip"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Download proxy failed", detail: msg }, { status: 502 });
  }
}
