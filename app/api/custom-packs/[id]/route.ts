import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  try {
    const r = await fetch(`${base}/custom-packs/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
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
