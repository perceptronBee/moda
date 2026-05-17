/**
 * Affiliate API kimlik doğrulama — production'da env zorunlu.
 *
 * Production:
 *   - PUBLISHER_KEYS env zorunlu (yoksa hiçbir publisher kabul edilmez)
 *   - ADMIN_KEY env zorunlu (yoksa hiçbir admin kabul edilmez)
 *
 * Development:
 *   - PUBLISHER_KEYS yoksa demo key fallback
 *   - ADMIN_KEY yoksa, sadece ALLOW_DEV_ADMIN=true ise dev key kabul edilir
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

const IS_PROD = process.env.NODE_ENV === "production";

export function isValidPublisherKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string" || key.length < 8) return false;

  const fromEnv = (process.env.PUBLISHER_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  // Production'da env yoksa hiçbir key kabul etme — fail-closed
  if (IS_PROD && fromEnv.length === 0) {
    console.error(
      "[security] PUBLISHER_KEYS env yok — tüm istekler reddediliyor",
    );
    return false;
  }

  // Dev fallback (sadece dev)
  const allowed = fromEnv.length > 0 ? fromEnv : ["demo_publisher_key_local"];
  return allowed.some((k) => safeEqual(k, key));
}

export function isValidAdminKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string" || key.length < 16) return false;

  const adminKey = process.env.ADMIN_KEY;

  // Production: ADMIN_KEY env zorunlu
  if (IS_PROD) {
    if (!adminKey) {
      console.error("[security] ADMIN_KEY env yok — admin erişimi reddedildi");
      return false;
    }
    return safeEqual(adminKey, key);
  }

  // Development: ADMIN_KEY varsa onunla doğrula
  if (adminKey) return safeEqual(adminKey, key);

  // Dev'de hiç env yoksa, sadece ALLOW_DEV_ADMIN=true ise sabit bir dev key kabul et
  if (process.env.ALLOW_DEV_ADMIN === "true") {
    return safeEqual("dev_admin_key_local_only_xx", key);
  }
  return false;
}
