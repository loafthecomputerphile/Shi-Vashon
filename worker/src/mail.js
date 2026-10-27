// mail.js — email the owner via Resend's HTTP API (Workers can't do SMTP).
// In Resend's test mode you can only send TO the account owner's own email
// address, which is exactly the flow we need: access requests go to you.
// Once a domain is verified, change `from` to e.g. "app@yourdomain.com".

export async function sendOwnerEmail(env, subject, text) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: env.OWNER_EMAIL,
        subject,
        text,
      }),
    });
    if (!res.ok) console.error("Resend error:", await res.text());
  } catch (e) {
    // Email failure must never break the API response — just log it.
    console.error("sendOwnerEmail failed:", e);
  }
}