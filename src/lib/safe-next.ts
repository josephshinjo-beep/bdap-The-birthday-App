// Only allow same-site relative paths as post-login redirects (no open redirects).
export function safeNext(value: string | null | undefined, fallback = "/rooms"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
