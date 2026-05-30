import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

const MAX_SIZES_PER_PACK = 7;
const VALID_ORIENTATIONS = new Set(["Portrait", "Landscape", "Square"]);

interface PackPayload {
  id?: string;
  name?: unknown;
  sizes?: unknown;
  orientation?: unknown;
}

function validatePack(body: PackPayload): { ok: true; pack: { id?: string; name: string; sizes: string[]; orientation: string } } | { ok: false; error: string } {
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { ok: false, error: "Pack name is required" };
  }
  if (body.name.length > 40) {
    return { ok: false, error: "Pack name too long (max 40 chars)" };
  }
  if (!Array.isArray(body.sizes) || body.sizes.length === 0) {
    return { ok: false, error: "Pack must contain at least one size" };
  }
  if (body.sizes.length > MAX_SIZES_PER_PACK) {
    return { ok: false, error: `Pack exceeds maximum of ${MAX_SIZES_PER_PACK} sizes` };
  }
  if (!body.sizes.every((s: unknown) => typeof s === "string" && s.length > 0 && s.length < 20)) {
    return { ok: false, error: "Invalid size identifier" };
  }
  const orientation = typeof body.orientation === "string" ? body.orientation : "Portrait";
  if (!VALID_ORIENTATIONS.has(orientation)) {
    return { ok: false, error: "Invalid orientation" };
  }
  return {
    ok: true,
    pack: {
      id: typeof body.id === "string" ? body.id : undefined,
      name: body.name.trim(),
      sizes: body.sizes as string[],
      orientation,
    },
  };
}

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
    const body = (await req.json()) as PackPayload;
    const validation = validatePack(body);
    if (validation.ok === false) {
      return Response.json({ error: validation.error }, { status: 400, headers: { "x-request-id": requestId } });
    }
    const r = await workerFetch("/custom-packs", "POST", token, validation.pack, requestId);
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

// DELETE via query param. Dynamic route /api/custom-packs/[id] does not work on
// CF Pages with the next-on-pages adapter — it returns Next.js /500 instead of
// matching the route. Reading id from ?id=... uses the parent static route
// which works reliably.
export async function DELETE(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || typeof id !== "string" || id.length === 0 || id.length > 100) {
      return Response.json(
        { error: "Missing or invalid id query parameter" },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }
    const { userId, getToken } = await auth();
    const token = userId ? await getToken({ template: "snap" }) : null;
    const r = await workerFetch(`/custom-packs/${encodeURIComponent(id)}`, "DELETE", token, undefined, requestId);
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
