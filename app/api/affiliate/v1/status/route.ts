import { NextResponse, type NextRequest } from "next/server";
import { getCacheStatus } from "@/lib/affiliate/feedCache";
import { isValidAdminKey, isValidPublisherKey } from "@/lib/affiliate/auth";

/**
 * GET /api/affiliate/v1/status
 *
 * Feed ingestion durumu — son refresh, sonraki tahmini refresh,
 * aktif perakendeciler, son aktivite log'u.
 *
 * AUTH: Admin veya Publisher key zorunlu — bu endpoint
 * iç ticari hacim metrik'leri sızdırır (information disclosure).
 *
 * Publisher key ile gelen istekte hassas alanlar (recentActivity,
 * priceChanges) gizlenir, sadece public özet döner.
 */
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  const publisherKey = req.headers.get("x-publisher-key");

  const isAdmin = isValidAdminKey(adminKey);
  const isPublisher = !isAdmin && isValidPublisherKey(publisherKey);

  if (!isAdmin && !isPublisher) {
    return NextResponse.json(
      { error: "Auth zorunlu (X-Admin-Key veya X-Publisher-Key)" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const full = getCacheStatus();

  // Publisher seviyesi — ticari metrik gizle
  if (isPublisher && !isAdmin) {
    return NextResponse.json(
      {
        lastRefresh: full.lastRefresh,
        nextRefresh: full.nextRefresh,
        refreshIntervalMs: full.refreshIntervalMs,
        totalProducts: full.totalProducts,
        activeRetailers: full.activeRetailers,
        // retailers ve recentActivity gizlendi
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Admin — tam görünüm
  return NextResponse.json(full, {
    headers: { "Cache-Control": "no-store" },
  });
}
