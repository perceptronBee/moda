/**
 * Affiliate API kimlik doğrulama.
 *
 * Demo'da `ADMIN_KEY` ve `PUBLISHER_KEYS` env değişkenleri.
 * Production'da DB tablosu (publishers) tutulurdu.
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

export function isValidPublisherKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string" || key.length < 8) return false;
  // PUBLISHER_KEYS: virgülle ayrılmış geçerli key listesi
  const allowed = (process.env.PUBLISHER_KEYS ?? "demo_publisher_key_2026")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return allowed.some((k) => safeEqual(k, key));
}

export function isValidAdminKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string" || key.length < 16) return false;
  const adminKey = process.env.ADMIN_KEY;
  // Admin key tanımlı değilse production'da hiçbir şey kabul etme
  if (!adminKey) return process.env.NODE_ENV !== "production";
  return safeEqual(adminKey, key);
}
