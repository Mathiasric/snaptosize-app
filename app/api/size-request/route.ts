import { auth, currentUser } from "@clerk/nextjs/server";
import { posthogCapture } from "@/app/lib/posthog";

export const runtime = "edge";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { size, page } = (await req.json().catch(() => ({}))) as {
    size?: string;
    page?: string;
  };

  if (!size || size.trim().length === 0) {
    return Response.json({ error: "Size is required" }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress || "unknown";
  const plan = (user?.publicMetadata as { plan?: string } | undefined)?.plan || "free";
  const distinctId = `clerk:${userId}`;

  // PostHog event
  await posthogCapture(distinctId, "size_requested", {
    size: size.trim(),
    page: page || "unknown",
    user_email: email,
    plan,
  });

  // Resend email notification
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "SnapToSize <support@snaptosize.com>",
          to: "support@snaptosize.com",
          subject: `Size request: ${size.trim()}`,
          text: `User: ${email}\nPlan: ${plan}\nPage: ${page || "unknown"}\n\nRequested size: ${size.trim()}`,
        }),
      });
    } catch {
      // Fail silent — PostHog already captured it
    }
  }

  return Response.json({ ok: true });
}
