import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/app/billing(.*)",
  "/app/dashboard(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Handle POST to /app/billing - redirect to GET
  // Prevents 405 from Stripe checkout POST redirects
  if (req.method === "POST" && req.nextUrl.pathname === "/app/billing") {
    const url = new URL(req.url);
    return NextResponse.redirect(url.toString(), 303);
  }

  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
