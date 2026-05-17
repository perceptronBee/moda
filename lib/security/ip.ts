/**
 * Güvenilir client IP çıkarımı — Vercel mimarisine özel.
 *
 * Saldırgan kendi `X-Forwarded-For: 1.2.3.4` header'ı ekleyerek gelir.
 * Vercel proxy bunu **append** eder, yani en sondaki IP gerçek client IP'sidir.
 * Sıralama: [saldırganın_fake_ipsi, ..., GERÇEK_CLIENT_IP]
 *
 * Güvenilirlik sırası:
 *   1. x-vercel-forwarded-for (Vercel'in kendi set ettiği, manipüle edilemez)
 *   2. x-real-ip (proxy tarafından set edilir, sadece prod'da güven)
 *   3. x-forwarded-for'un EN SAĞINDAKİ entry (Vercel'in eklediği)
 *
 * Dev'de header'a güvenmiyoruz.
 */
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isValidIp(s: string): boolean {
  if (!s) return false;
  if (s.length > 64) return false;
  return IPV4.test(s) || IPV6.test(s);
}

export function getClientIp(headers: Headers): string | null {
  const trustProxy = process.env.NODE_ENV === "production";
  if (!trustProxy) return null;

  // 1. Vercel'in kendi başlığı — saldırgan ekleyemez, edge tarafından set edilir
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim() ?? "";
    if (isValidIp(first)) return first;
  }

  // 2. x-real-ip — Vercel/Cloudflare tarafından set edilir
  const xrip = headers.get("x-real-ip");
  if (xrip && isValidIp(xrip.trim())) return xrip.trim();

  // 3. x-forwarded-for'un EN SAĞINDAKİ entry — Vercel'in eklediği gerçek IP
  // (saldırgan en soldakine sahte IP ekleyebilir)
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const ips = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // En sağdaki güvenilir entry (Vercel'in eklediği son hop)
    for (let i = ips.length - 1; i >= 0; i--) {
      if (isValidIp(ips[i])) return ips[i];
    }
  }

  return null;
}
