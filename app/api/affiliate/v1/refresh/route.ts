import { NextResponse, type NextRequest } from "next/server";
import { refresh } from "@/lib/affiliate/feedCache";
import { isValidAdminKey } from "@/lib/affiliate/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

/**
 * POST /api/affiliate/v1/refresh
 *
 * Cache'i yeniden çeker. SADECE admin tetikleyebilir.
 *
 * Auth: X-Admin-Key header (env: ADMIN_KEY)
 * Rate limit: IP başına dakikada 6 istek
 */
export async function POST(req: NextRequest) {
  // Admin auth
  const key = req.headers.get("x-admin-key");
  if (!isValidAdminKey(key)) {
    return NextResponse.json(
      { error: "Yetkisiz" },
      { status: 401, headers: { "WWW-Authenticate": "X-Admin-Key" } },
    );
  }

  // Rate limit — refresh spam DoS önleme
  const ip = getClientIp(req.headers) ?? "anon";
  const limit = rateLimit(`refresh:${ip}`, RATE_LIMITS.refresh);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek", retryAfter: limit.retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const status = refresh();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
