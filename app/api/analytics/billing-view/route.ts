import { auth, currentUser } from "@clerk/nextjs/server";
import { posthogCapture } from "@/app/lib/posthog";

export const runtime = "edge";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { source, kind, success, canceled } = (await req.json().catch(() => ({}))) as {
    source?: string;
    kind?: string;
    success?: boolean;
    canceled?: boolean;
  };

  const user = await currentUser();
  const plan_before = (user?.publicMetadata as { plan?: string } | undefined)?.plan || "free";
  const distinctId = `clerk:${userId}`;

  // Track billing page view and capture PostHog response for debug
  const phResult = await posthogCapture(distinctId, "billing_view", {
    source: source || null,
    kind: kind || null,
    success: success || false,
    canceled: canceled || false,
    plan_before,
  });

  // Track upgrade_clicked only when arriving from a specific source
  if (source) {
    await posthogCapture(distinctId, "upgrade_clicked", {
      source,
      kind: kind || null,
      entry: "billing_page",
      plan_before,
    });
  }

  return Response.json({
    ok: true,
    posthog_host: phResult?.host ?? null,
    posthog_status: phResult?.status ?? "no_key",
    posthog_body: phResult?.body ?? null,
    has_posthog_key: !!process.env.POSTHOG_API_KEY,
  });
}
