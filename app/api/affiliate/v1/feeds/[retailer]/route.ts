import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { RETAILERS } from "@/lib/affiliate/retailers";

// Prototype pollution koruması — __proto__, constructor gibi key'leri reddet
function isKnownRetailer(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(RETAILERS, slug);
}

/**
 * GET /api/affiliate/v1/feeds/{retailer}
 *
 * Perakendecinin ham XML feed'ini döner. Gerçek hayatta perakendeciler
 * bu feed'i kendi sunucularında host eder; biz simülasyonda kendi
 * data/feeds/ klasörümüzden serve ediyoruz.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ retailer: string }> },
) {
  const { retailer } = await params;

  // Prototype pollution + path traversal koruması
  if (
    typeof retailer !== "string" ||
    !/^[a-z0-9_-]+$/i.test(retailer) ||
    !isKnownRetailer(retailer)
  ) {
    return NextResponse.json(
      { error: `Bilinmeyen retailer` },
      { status: 404 },
    );
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "feeds",
    `${retailer}.xml`,
  );
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Bu retailer için henüz feed yok" },
      { status: 404 },
    );
  }
  const xml = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
