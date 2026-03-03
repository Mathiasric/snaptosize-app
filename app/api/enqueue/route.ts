import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "edge";

// ⚠️ TEMPORARY DEBUG OVERRIDE — remove after investigation
const PRO_OVERRIDE_USER_IDS = new Set([
  "user_3ALB5n58NGzff0xmR1RPMpBKSzN",
]);

export async function POST(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return Response.json({ error: "WORKER_BASE_URL not configured" }, { status: 500 });
  }

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const { userId, getToken, sessionClaims } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  // --- DEBUG: log Clerk metadata and JWT claims ---
  let clerkPlan: string | undefined;
  if (userId) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      clerkPlan = (user.publicMetadata as { plan?: string })?.plan;
    } catch (e) {
      console.log(JSON.stringify({ layer: "next", event: "enqueue_debug", request_id: requestId, user_id: userId, error: "clerk_fetch_failed", detail: String(e) }));
    }
  }

  // Decode JWT to inspect claims (without verification — just for logging)
  let jwtClaims: Record<string, unknown> | null = null;
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        jwtClaims = JSON.parse(atob(parts[1]));
      }
    } catch {}
  }

  console.log(JSON.stringify({
    layer: "next",
    event: "enqueue_debug",
    request_id: requestId,
    user_id: userId,
    clerk_public_metadata_plan: clerkPlan,
    session_claims_plan: (sessionClaims as Record<string, unknown>)?.plan,
    jwt_template_claims: jwtClaims ? { plan: jwtClaims.plan, metadata: jwtClaims.metadata, public_metadata: jwtClaims.public_metadata } : null,
    has_token: !!token,
    is_pro_override: userId ? PRO_OVERRIDE_USER_IDS.has(userId) : false,
    env: process.env.NODE_ENV,
    worker_base: base?.replace(/https?:\/\//, "").split("/")[0],
  }));
  // --- END DEBUG ---

  const payload = await req.json();

  const start = Date.now();
  try {
    const r = await fetch(`${base}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // ⚠️ TEMPORARY: override header for pro users stuck as free
        ...(userId && PRO_OVERRIDE_USER_IDS.has(userId) ? { "x-plan-override": "pro" } : {}),
      },
      body: JSON.stringify(payload),
    });

    const ms = Date.now() - start;
    const workerRequestId = r.headers.get("x-request-id") || requestId;

    // --- DEBUG: log 402 response body ---
    const text = await r.text();
    if (r.status === 402) {
      console.log(JSON.stringify({
        layer: "next",
        event: "enqueue_402_debug",
        request_id: workerRequestId,
        user_id: userId,
        clerk_plan: clerkPlan,
        is_pro_override: userId ? PRO_OVERRIDE_USER_IDS.has(userId) : false,
        worker_response: text.slice(0, 500),
      }));
    }

    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: workerRequestId, endpoint: "/api/enqueue", worker_path: "/enqueue", status: r.status, ms, user_id: userId || undefined, job_id: payload.job_id || undefined }));

    return new Response(text, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "x-request-id": workerRequestId,
      },
    });
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.log(JSON.stringify({ layer: "next", event: "worker_call", request_id: requestId, endpoint: "/api/enqueue", worker_path: "/enqueue", status: 502, ms, user_id: userId || undefined, error: msg }));
    return Response.json({ error: "Enqueue proxy failed", detail: msg }, { status: 502, headers: { "x-request-id": requestId } });
  }
}
