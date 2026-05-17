import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { isValidPublisherKey } from "@/lib/affiliate/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

/**
 * Deeplink güvenli mi? — Sadece http/https, perakendecinin domain'i ile eşleşmeli.
 * `javascript:`, `data:`, `file:` gibi protokolleri engelle (XSS/Phishing).
 */
function isSafeDeeplink(url: string, retailerDomain: string): boolean {
  if (!url || typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  // Host kontrolü — retailer domain'inin alt-domain'i olmalı veya tam eşleşmeli
  const host = parsed.hostname.toLowerCase();
  const expected = retailerDomain.toLowerCase().replace(/^www\./, "");
  return host === expected || host.endsWith(`.${expected}`);
}

/**
 * POST /api/affiliate/v1/track/click
 * Body: { productId, userId? }
 * Auth: X-Publisher-Key header (publisher API key)
 *
 * Click'i kaydeder, komisyon hesaplar, redirect URL döner.
 * Redirect URL'i scheme + domain doğrulanmış güvenli URL'dir.
 */
export async function POST(req: NextRequest) {
  // Publisher auth — feed poisoning ile abuse önleme
  if (!isValidPublisherKey(req.headers.get("x-publisher-key"))) {
    return NextResponse.json(
      { error: "Geçersiz X-Publisher-Key" },
      { status: 401 },
    );
  }

  // Click fraud koruması — IP başına dakikada 60 click
  const ip = getClientIp(req.headers) ?? "anon";
  const limit = rateLimit(`click:${ip}`, RATE_LIMITS.click);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla click", retryAfter: limit.retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    userId?: string;
  } | null;

  if (!body?.productId || typeof body.productId !== "string") {
    return NextResponse.json(
      { error: "productId zorunlu" },
      { status: 400 },
    );
  }

  const product = loadAllFeeds().find((p) => p.id === body.productId);
  if (!product || !product.retailer || !product.deeplink) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }

  const retailer = RETAILERS[product.retailer];
  if (!retailer) {
    return NextResponse.json(
      { error: "Geçersiz retailer" },
      { status: 400 },
    );
  }

  // Deeplink güvenlik kontrolü — feed poisoning'e karşı
  if (!isSafeDeeplink(product.deeplink, retailer.domain)) {
    console.warn(
      `[FEED POISONING?] product=${product.id} unsafe deeplink=${product.deeplink}`,
    );
    return NextResponse.json(
      { error: "Güvensiz deeplink — kaynak feed kontrol edilmeli" },
      { status: 502 },
    );
  }

  const estimatedCommission = product.price * retailer.commission;
  const clickId = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  console.log("[affiliate/click]", {
    clickId,
    productId: product.id,
    retailer: retailer.slug,
    userId: body.userId ?? null,
    price: product.price,
    commission: estimatedCommission,
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    clickId,
    redirectUrl: product.deeplink,
    estimatedCommission: {
      amount: Math.round(estimatedCommission * 100) / 100,
      currency: "TRY",
      rate: retailer.commission,
    },
  });
}
