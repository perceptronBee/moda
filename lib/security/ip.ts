/**
 * Güvenilir client IP çıkarımı.
 *
 * X-Forwarded-For ve diğer proxy header'larına SADECE production'da
 * (Vercel, Cloudflare gibi güvenilir proxy arkasında) güvenilir.
 * Aksi halde sahte IP kabul edilebilir. Dev'de header'a güvenme.
 *
 * Audit ile kayıt için: filtrelenmiş IPv4/IPv6 deseni ile uyuşmazsa null döner.
 */
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isValidIp(s: string): boolean {
  if (!s) return false;
  if (s.length > 64) return false;
  return IPV4.test(s) || IPV6.test(s);
}

export function getClientIp(headers: Headers): string | null {
  // Production'da Vercel + Cloudflare proxy header'larına güvenebiliriz
  const trustProxy = process.env.NODE_ENV === "production";
  if (!trustProxy) return null;

  // Vercel kendisi X-Forwarded-For'u set eder, en soldaki client IP'sidir
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim() ?? "";
    if (isValidIp(first)) return first;
  }
  const xrip = headers.get("x-real-ip");
  if (xrip && isValidIp(xrip.trim())) return xrip.trim();

  return null;
}
