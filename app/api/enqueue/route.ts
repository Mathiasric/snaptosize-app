import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) return new Response("Missing WORKER_BASE_URL", { status: 500 });

  const payload = await req.json(); // { image_key, group, demo? }

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
}
