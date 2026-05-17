/**
 * Basit in-memory rate limiter — sliding window.
 *
 * Hackathon için yeterli; production'da Redis/Upstash önerilir.
 * Aynı process içinde key bazlı tutar, server restart'ta sıfırlanır.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitConfig = {
  /** zaman penceresi (ms) */
  windowMs: number;
  /** o pencerede izin verilen max istek */
  max: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** kalan istek hakkı */
  remaining: number;
  /** ne zaman sıfırlanır (epoch ms) */
  resetAt: number;
  /** kaç saniye sonra retry edebilir */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      ok: true,
      remaining: config.max - 1,
      resetAt: now + config.windowMs,
      retryAfter: 0,
    };
  }

  existing.count += 1;
  if (existing.count > config.max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, config.max - existing.count),
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

// Periyodik temizlik — eski bucket'ları sil (memory leak önle)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of store.entries()) {
      if (b.resetAt < now) store.delete(key);
    }
  }, 60_000).unref?.();
}

// Hazır profiller
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60_000, max: 8 }, // 15dk'da 8 deneme
  signup: { windowMs: 60 * 60_000, max: 5 }, // saatte 5 kayıt
  passwordReset: { windowMs: 60 * 60_000, max: 3 }, // saatte 3 sıfırlama isteği
  refresh: { windowMs: 60_000, max: 6 }, // dakikada 6 refresh
  click: { windowMs: 60_000, max: 60 }, // dakikada 60 click (saniyede 1, click fraud)
  aiRequest: { windowMs: 60_000, max: 5 }, // dakikada 5 AI isteği (kombin/try-on)
  photoUpload: { windowMs: 60_000, max: 6 }, // dakikada 6 foto upload (CPU + storage)
} as const;
