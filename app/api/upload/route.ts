import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const body = await req.arrayBuffer();

  try {
    const r = await fetch(`${base}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Upload proxy failed", detail: msg }, { status: 502 });
  }
}
