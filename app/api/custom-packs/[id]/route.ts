import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  let stage = "init";
  try {
    stage = "params";
    const { id } = await params;
    stage = "auth";
    const { userId, getToken } = await auth();
    stage = "getToken";
    const token = userId ? await getToken({ template: "snap" }) : null;
    stage = "env";
    const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
    if (!base) {
      return Response.json(
        { error: "WORKER_BASE_URL not configured", stage, requestId },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }
    stage = "worker-fetch";
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
      return Response.json(
        { error: msg, stage: "worker-fetch", requestId },
        { status: 502, headers: { "x-request-id": requestId } }
      );
    }
  } catch (outerErr) {
    const msg = outerErr instanceof Error ? outerErr.message : "Unknown error";
    const name = outerErr instanceof Error ? outerErr.name : "UnknownError";
    const stack = outerErr instanceof Error ? outerErr.stack?.slice(0, 500) ?? "" : "";
    return Response.json(
      { error: msg, name, stage, stack, requestId, where: "delete-handler-outer" },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
