import * as Sentry from "@sentry/nextjs";

export const runtime = "edge";

export async function GET() {
  // Test Sentry error tracking
  Sentry.captureException(new Error("🧪 Sentry test error from API route"), {
    tags: {
      test: "true",
      route: "/api/sentry-test",
    },
    level: "info",
  });

  return Response.json({
    message: "Test error sent to Sentry. Check your Sentry dashboard.",
    timestamp: new Date().toISOString(),
  });
}
