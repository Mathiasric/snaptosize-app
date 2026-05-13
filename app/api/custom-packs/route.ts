import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

async function workerFetch(path: string, method: string, token: string | null, body?: unknown, requestId?: string) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("WORKER_BASE_URL not configured");
  return fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId || crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;
  try {
    const r = await workerFetch("/custom-packs", "GET", token, undefined, requestId);
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502, headers: { "x-request-id": requestId } });
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;
  try {
    const body = await req.json();
    const r = await workerFetch("/custom-packs", "POST", token, body, requestId);
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502, headers: { "x-request-id": requestId } });
  }
}
