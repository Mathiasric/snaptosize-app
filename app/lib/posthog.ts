// Server-side PostHog capture (fail-silent)
export async function posthogCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const host = process.env.POSTHOG_HOST || "https://eu.posthog.com";
  const apiKey = process.env.POSTHOG_API_KEY;

  if (!apiKey) return;

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
    console.log("POSTHOG HOST:", host);
    console.log("POSTHOG STATUS:", res.status);
    const text = await res.text();
    console.log("POSTHOG RESPONSE:", text);
  } catch {
    // Fail silent
  }
}
