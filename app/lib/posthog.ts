// Server-side PostHog capture (fail-silent)
export async function posthogCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const host = process.env.POSTHOG_HOST || "https://eu.posthog.com";
  const apiKey = process.env.POSTHOG_API_KEY;

  if (!apiKey) return;

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: { distinct_id: distinctId, ...properties },
      }),
    });
  } catch {
    // Fail silent
  }
}
