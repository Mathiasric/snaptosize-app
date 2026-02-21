import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const payload = await req.json();

  try {
    const r = await fetch(`${base}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Enqueue proxy failed", detail: msg }, { status: 502 });
  }
}
