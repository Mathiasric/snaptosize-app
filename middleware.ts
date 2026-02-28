import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/app/billing(.*)",
  "/app/dashboard(.*)",
]);

// Static page routes that cannot handle POST (server action or Stripe redirect)
const staticAppPages = new Set(["/app/billing", "/app/packs", "/app/quick-export", "/app"]);

export default clerkMiddleware(async (auth, req) => {
  if (req.method === "POST" && staticAppPages.has(req.nextUrl.pathname)) {
    // Clerk server action POST (invalidateCacheAction) — return empty success
    if (req.headers.get("next-action")) {
      return new NextResponse("0:{}\n", {
        status: 200,
        headers: { "content-type": "text/x-component" },
      });
    }
    // Stripe checkout POST redirect — 303 to GET
    return NextResponse.redirect(new URL(req.url).toString(), 303);
  }

  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
