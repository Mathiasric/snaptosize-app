// Server-side Resend alert (fail-silent, edge-compatible)
export async function sendAlert(
  subject: string,
  body: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!apiKey || !alertEmail) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "SnapToSize Alerts <alerts@snaptosize.com>",
        to: alertEmail,
        subject: `🚨 ${subject}`,
        text: body,
      }),
    });
  } catch {
    // Fail silent — never block the response
  }
}
