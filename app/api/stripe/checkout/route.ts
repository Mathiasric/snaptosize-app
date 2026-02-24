import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { posthogCapture } from "@/app/lib/posthog";

export const runtime = "edge";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  const { interval } = (await req.json().catch(() => ({}))) as {
    interval?: "monthly" | "yearly";
  };

  const priceMonthly = process.env.PRICE_ID_PRO_MONTHLY;
  const priceYearly = process.env.PRICE_ID_PRO_YEARLY;

  const priceId = interval === "yearly" && priceYearly ? priceYearly : priceMonthly;
  if (!priceId) return new Response("Missing price config", { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing?success=1`,
    cancel_url: `${appUrl}/app/billing?canceled=1`,
    client_reference_id: userId,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    ...(email ? { customer_email: email } : {}),
  });

  posthogCapture(userId, "checkout_started", { interval: interval || "monthly" });

  return Response.json({ url: session.url });
}
