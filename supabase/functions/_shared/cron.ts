// Shared check for scheduled (cron) Edge Functions. Callers must send the
// header `x-cron-secret` equal to the CRON_SECRET secret (at least 24 chars).
// EMAIL_RETRY_SECRET is still accepted for older email-retry schedules.
// Runtime-agnostic: `get` reads environment variables.

export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export function cronSecretValid(
  req: Request,
  get: (key: string) => string | undefined,
): "ok" | "unauthorized" | "not_configured" {
  const secrets = [get("CRON_SECRET"), get("EMAIL_RETRY_SECRET")].filter((s): s is string => !!s && s.length >= 24);
  if (secrets.length === 0) return "not_configured";
  const provided = req.headers.get("x-cron-secret") || "";
  return secrets.some((s) => timingSafeEqual(provided, s)) ? "ok" : "unauthorized";
}
