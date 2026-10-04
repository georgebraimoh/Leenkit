// Transactional email through Resend (https://resend.com/docs/api-reference).
//
// Runtime-agnostic on purpose (no Deno APIs, no remote imports) so it can be
// unit-tested outside Edge Functions. Configuration comes from secrets:
//   RESEND_API_KEY   required to send; if missing, sending is skipped
//   EMAIL_FROM       required, e.g. "LEENKIT <no-reply@mail.yourdomain.com>"
//                    (must be on a domain verified in Resend)
//   EMAIL_REPLY_TO   optional reply-to address
//   APP_URL          public site URL for links (default production site)
//   SUPPORT_EMAIL    contact shown in emails (default qleenqapp@gmail.com)

export type EmailConfig = {
  apiKey?: string;
  from?: string;
  replyTo?: string;
  appUrl: string;
  supportEmail: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type SendResult =
  | { sent: true; id?: string }
  | { sent: false; skipped: string }
  | { sent: false; error: string };

export function emailConfigFromEnv(get: (key: string) => string | undefined): EmailConfig {
  const appUrl = (get("APP_URL") || "https://leenkit.netlify.app").trim().replace(/\/+$/, "");
  return {
    apiKey: get("RESEND_API_KEY")?.trim() || undefined,
    from: get("EMAIL_FROM")?.trim() || undefined,
    replyTo: get("EMAIL_REPLY_TO")?.trim() || undefined,
    appUrl,
    supportEmail: get("SUPPORT_EMAIL")?.trim() || "qleenqapp@gmail.com",
  };
}

export function isEmailConfigured(cfg: EmailConfig): boolean {
  return Boolean(cfg.apiKey && cfg.from);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export async function sendEmail(
  cfg: EmailConfig,
  msg: EmailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!isEmailConfigured(cfg)) return { sent: false, skipped: "email_not_configured" };
  if (!isValidEmail(msg.to)) return { sent: false, skipped: "invalid_recipient" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  // Resend de-duplicates requests that reuse an idempotency key.
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey.slice(0, 256);

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: cfg.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
      }),
    });
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      const message = typeof body?.message === "string" ? body.message : `Resend request failed (${res.status})`;
      return { sent: false, error: message.slice(0, 300) };
    }
    return { sent: true, id: typeof body?.id === "string" ? body.id : undefined };
  } catch (err) {
    return { sent: false, error: String((err as Error)?.message || err).slice(0, 300) };
  }
}

// ---------------------------------------------------------------------------
// Payment emails
// ---------------------------------------------------------------------------
export type PaymentEmailKind = "receipt" | "payment_not_confirmed";

export type PaymentEmailData = {
  kind: PaymentEmailKind;
  paymentType: "ticket" | "sponsorship";
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
  hangoutId: string;
  hangoutTitle?: string | null;
  hangoutDate?: string | null;
  hangoutTime?: string | null;
  venue?: string | null;
};

export function formatMoney(amount: number, currency: string): string {
  const code = (currency || "NGN").toUpperCase();
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: code }).format(Number(amount));
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

function formatPaidAt(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toUTCString().replace("GMT", "UTC");
}

export function buildPaymentEmail(data: PaymentEmailData, cfg: EmailConfig): { subject: string; html: string; text: string } {
  const title = data.hangoutTitle?.trim() || "your Hangout";
  const money = formatMoney(data.amount, data.currency);
  const hangoutUrl = `${cfg.appUrl}/hangout/${encodeURIComponent(data.hangoutId)}`;
  const when = [data.hangoutDate, data.hangoutTime].filter(Boolean).join(" at ");
  const paid = formatPaidAt(data.paidAt);

  let subject: string;
  let intro: string;
  if (data.kind === "receipt" && data.paymentType === "ticket") {
    subject = `Your ticket for ${title} is confirmed`;
    intro = `Your payment was successful and your spot at ${title} is confirmed.`;
  } else if (data.kind === "receipt") {
    subject = `Thank you for sponsoring ${title}`;
    intro = `Your sponsorship payment for ${title} was successful.`;
  } else {
    subject = `About your payment for ${title}`;
    intro =
      `We received your payment for ${title}, but we could not confirm your spot ` +
      `(for example, the Hangout was full or no longer open), so you have not been added as an attendee. ` +
      `Please keep this email and contact us about this payment.`;
  }

  const rows: Array<[string, string]> = [
    ["Hangout", title],
    ...(when ? [["Date", when] as [string, string]] : []),
    ...(data.venue ? [["Venue", data.venue] as [string, string]] : []),
    [data.kind === "receipt" ? "Amount paid" : "Amount received", money],
    ["Payment type", data.paymentType === "ticket" ? "Ticket" : "Sponsorship"],
    ["Reference", data.reference],
    ...(paid ? [["Paid at", paid] as [string, string]] : []),
  ];

  const text = [
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `View the Hangout: ${hangoutUrl}`,
    "",
    `Questions about this payment? Email ${cfg.supportEmail} and include your reference.`,
    "",
    "LEENKIT — real-life Hangouts. Payments are processed by Paystack.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F7F5EF;font-family:Arial,Helvetica,sans-serif;color:#172121">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #DDE3E0;border-radius:16px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#087F73;letter-spacing:.04em">LEENKIT</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(subject)}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3D4948">${escapeHtml(intro)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #DDE3E0">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 0;color:#687473;width:40%;border-bottom:1px solid #EEF1EF">${escapeHtml(k)}</td><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #EEF1EF">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
      <p style="margin:24px 0">
        <a href="${escapeHtml(hangoutUrl)}" style="display:inline-block;background:#18A999;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:999px">View the Hangout</a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#687473">
        Questions about this payment? Email <a href="mailto:${escapeHtml(cfg.supportEmail)}" style="color:#087F73">${escapeHtml(cfg.supportEmail)}</a> and include your reference.<br>
        Payments are processed by Paystack.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
