import { NextResponse } from "next/server";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";

/**
 * GET /api/affiliate/v1/feeds
 *
 * Aktif perakendecilerin listesi ve her birinden gelen ürün sayısı.
 */
export async function GET() {
  const all = loadAllFeeds();
  const feeds = Object.values(RETAILERS).map((r) => {
    const count = all.filter((p) => p.retailer === r.slug).length;
    return {
      slug: r.slug,
      name: r.name,
      domain: r.domain,
      commission: r.commission,
      productCount: count,
      feedUrl: `/api/affiliate/v1/feeds/${r.slug}`,
    };
  });
  return NextResponse.json({ feeds });
}
