// Server-side PostHog capture — temporary debug version
export async function posthogCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<{ status: number; body: string; host: string } | null> {
  const host = process.env.POSTHOG_HOST || "https://eu.posthog.com";
  const apiKey = process.env.POSTHOG_API_KEY;

  if (!apiKey) return null;

  const payload = {
    api_key: apiKey,
    event,
    properties: { distinct_id: distinctId, ...properties },
  };

  try {
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    return { status: res.status, body, host };
  } catch (err) {
    return { status: 0, body: err instanceof Error ? err.message : "fetch failed", host };
  }
}
