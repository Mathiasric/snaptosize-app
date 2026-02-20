import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) return new Response("Missing WORKER_BASE_URL", { status: 500 });

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const body = await req.arrayBuffer();

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
}
