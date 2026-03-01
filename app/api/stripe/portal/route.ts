import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { posthogCapture } from "@/app/lib/posthog";

export const runtime = "edge";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  if (!user) return Response.json({ error: "User not found" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Resolve Stripe customer ID
  let customerId = (user.privateMetadata as { stripeCustomerId?: string })?.stripeCustomerId
    || (user.publicMetadata as { stripeCustomerId?: string })?.stripeCustomerId;

  if (!customerId) {
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) return Response.json({ error: "No email on account" }, { status: 400 });

    // Search existing Stripe customers by email
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const created = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = created.id;
    }

    // Persist for next time
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: { stripeCustomerId: customerId },
    });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/app/billing?portal=1`,
    });
    const distinctId = `clerk:${userId}`;
    const plan_before = (user.publicMetadata as { plan?: string } | undefined)?.plan || "free";
    await posthogCapture(distinctId, "portal_opened", {
      plan_before,
      entry: "billing_manage_subscription",
    });
    // Temporary debug fields — remove after verification
    const body = JSON.stringify({
      ok: true,
      url: session.url,
      has_posthog_key: !!process.env.POSTHOG_API_KEY,
      distinct_id_used: distinctId,
      plan_before,
    });
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "Portal session failed", detail: msg }, { status: 500 });
  }
}
