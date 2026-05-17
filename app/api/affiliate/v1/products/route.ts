import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";
import { RETAILERS, type RetailerSlug } from "@/lib/affiliate/retailers";
import { isValidPublisherKey } from "@/lib/affiliate/auth";

const MAX_LIMIT = 200;
const MAX_OFFSET = 100_000;

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (raw === null) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function GET(req: NextRequest) {
  // Gerçek key doğrulama — sabit zamanlı karşılaştırma
  const publisherKey = req.headers.get("x-publisher-key");
  if (!isValidPublisherKey(publisherKey)) {
    return NextResponse.json(
      { error: "Geçersiz X-Publisher-Key" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const retailer = searchParams.get("retailer") as RetailerSlug | null;
  const gender = searchParams.get("gender");
  const category = searchParams.get("category");

  // Pagination — negatif/aşırı büyük değerlere karşı koruma
  const limit = clampInt(searchParams.get("limit"), 50, 1, MAX_LIMIT);
  const offset = clampInt(searchParams.get("offset"), 0, 0, MAX_OFFSET);

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
