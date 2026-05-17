/**
 * Güvenli site URL'i — Host header'a güvenmek YASAK (Host Header Injection).
 * Sadece NEXT_PUBLIC_SITE_URL env değişkeni kullanılır. Yoksa local dev fallback.
 */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url && /^https?:\/\//.test(url)) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error(
    "NEXT_PUBLIC_SITE_URL ortam değişkeni production'da zorunlu",
  );
}

/**
 * Açık yönlendirme önler — sadece kendi domain'imize, sadece path olarak yönlendir.
 * Harici URL, protocol-relative URL, javascript: protokolü engelle.
 * Dönen değer her zaman "/" ile başlayan güvenli bir yol.
 */
export function safeNextPath(
  raw: unknown,
  fallback = "/",
): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // "/" ile başlayan ama "//" veya "/\" değil → güvenli internal path
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.startsWith("/@")
  ) {
    // Newline / null byte filtre
    if (/[\r\n\0]/.test(trimmed)) return fallback;
    return trimmed;
  }

  return fallback;
}

/**
 * Dış (perakendeci) URL'i sadece http/https'e izin verir.
 * `javascript:`, `data:`, `file:`, `vbscript:` gibi protokolleri engeller.
 * Feed poisoning sonrası render edilecek URL'lere uygulanır.
 */
export function safeExternalUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
