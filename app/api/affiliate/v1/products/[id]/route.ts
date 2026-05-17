import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";
import { isValidPublisherKey } from "@/lib/affiliate/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

// Scraping rate limit — publisher key + IP başına dakikada 120 istek
const PRODUCT_GET_LIMIT = { windowMs: 60_000, max: 120 } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const publisherKey = req.headers.get("x-publisher-key");
  if (!isValidPublisherKey(publisherKey)) {
    return NextResponse.json(
      { error: "Geçersiz X-Publisher-Key" },
      { status: 401 },
    );
  }

  // Rate limit — partner key sızıntısı veya scraping abuse'a karşı
  const ip = getClientIp(req.headers) ?? "anon";
  const keyHash = (publisherKey ?? "").slice(0, 16);
  const rl = rateLimit(`product:${keyHash}:${ip}`, PRODUCT_GET_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek", retryAfter: rl.retryAfter },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      },
    );
  }

  const { id } = await params;

  // Path traversal / format koruması
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id) || id.length > 64) {
    return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });
  }

  const product = loadAllFeeds().find((p) => p.id === id);
  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(product);
}
