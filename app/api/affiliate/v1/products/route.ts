import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";
import { RETAILERS, type RetailerSlug } from "@/lib/affiliate/retailers";

/**
 * GET /api/affiliate/v1/products
 *
 * Query parametreleri:
 *   ?retailer=lcwaikiki     — sadece bu mağaza
 *   ?gender=kadin|erkek|cocuk
 *   ?category=ust-giyim
 *   ?limit=50
 *   ?offset=0
 *
 * Cevap (JSON):
 * {
 *   "total": 123,
 *   "limit": 50,
 *   "offset": 0,
 *   "items": [Product, ...]
 * }
 *
 * Auth: header `X-Publisher-Key: <key>` — demo'da herhangi bir değer geçerli.
 */
export async function GET(req: NextRequest) {
  const publisherKey = req.headers.get("x-publisher-key");
  if (!publisherKey) {
    return NextResponse.json(
      { error: "X-Publisher-Key header gerekli" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const retailer = searchParams.get("retailer") as RetailerSlug | null;
  const gender = searchParams.get("gender");
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  let products = loadAllFeeds();
  if (retailer) {
    if (!RETAILERS[retailer]) {
      return NextResponse.json(
        { error: `Bilinmeyen retailer: ${retailer}` },
        { status: 400 },
      );
    }
    products = products.filter((p) => p.retailer === retailer);
  }
  if (gender) products = products.filter((p) => p.gender === gender);
  if (category) products = products.filter((p) => p.type === category);

  const total = products.length;
  const items = products.slice(offset, offset + limit);

  return NextResponse.json({ total, limit, offset, items });
}
