import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

export const runtime = "edge";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

// Idempotency guard: in-memory Set (scoped per worker instance)
const processedEvents = new Set<string>();

async function updatePlan(userId: string, plan: "pro" | "free", stripeCustomerId?: string) {
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { plan },
    ...(stripeCustomerId ? { privateMetadata: { stripeCustomerId } } : {}),
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return Response.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check: prevent duplicate processing
  if (processedEvents.has(event.id)) {
    return Response.json({ received: true });
  }
  processedEvents.add(event.id);

  try {
    switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = session.client_reference_id || session.metadata?.userId;
      if (!userId) break;
      const customerId = typeof session.customer === "string" ? session.customer : undefined;
      await updatePlan(userId, "pro", customerId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;
      const activeStatuses = ["active", "trialing", "past_due"];
      const active = activeStatuses.includes(sub.status);
      const custId = typeof sub.customer === "string" ? sub.customer : undefined;
      await updatePlan(userId, active ? "pro" : "free", custId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;
      await updatePlan(userId, "free");
      break;
    }
    }
  } catch (err) {
    console.error("Webhook processing failed:", {
      event_id: event.id,
      event_type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
